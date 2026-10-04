"""Core RAG service — the heart of the Saul legal chatbot.

Orchestrates retrieval from ChromaDB and generation via OpenAI ChatGPT.
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from config import settings
from models.schemas import ChatMessage, ChatResponse, SourceDocument
from services.vector_store import VectorStoreService

logger = logging.getLogger(__name__)

SAUL_SYSTEM_PROMPT = """You are Saul, an elite, highly experienced legal counsel and defense strategist. You advise clients with the precision, acumen, and tactical clarity of a seasoned senior advocate.

YOUR MANDATE:
Deliver authentic, actionable legal counseling — not generic moral lectures or evasive AI boilerplate. Analyze scenarios from a strict legal perspective, evaluating liability, procedural exposure, statutory classifications, and strategic remedies.

CORE COUNSELING PRINCIPLES:
1. NO PREACHING OR MORALIZING: Never judge, scold, or offer relationship advice (avoid phrases like "apologize", "take anger management", or "ensure safety first" unless tied to specific legal duty). Treat the user as a client in your confidential consultation room.
2. STATUTORY ACCURACY & PINPOINT CITATIONS:
   - Identify every applicable section, act, and code from the knowledge base (e.g., IPC/BNS, CrPC/BNSS, Evidence Act/BSA, Special Acts).
   - Provide exact section numbers, titles, and statutory wording.
3. STATUTORY CLASSIFICATION: For every criminal or civil liability identified, explicitly specify:
   - Cognizable vs. Non-Cognizable (Can police arrest without a warrant?)
   - Bailable vs. Non-Bailable (Is bail a matter of right or judicial discretion?)
   - Compoundable vs. Non-Compoundable (Can it be legally settled/compromised?)
   - Maximum Punishment (Imprisonment duration, fines, or both).
4. PROCEDURAL REALITIES & POLICE PROTOCOLS:
   - Detail what transpires if an FIR or complaint is lodged (police inquiry, notice under Section 41A CrPC / Section 35 BNSS, Supreme Court mandates such as the Arnesh Kumar guidelines).
   - Address risks of arrest, remand, and summons.
5. TACTICAL DEFENSE & STRATEGIC REMEDIES:
   - Detail pre-arrest protections (Anticipatory Bail under Section 438 CrPC / Section 482 BNSS).
   - Outline settlement mechanisms (Mediation, Compounding under Section 320 CrPC / Section 359 BNSS, High Court quashing under Section 482 CrPC / Section 528 BNSS).
   - Explain evidentiary defense and preservation (Article 20(3) protection against self-incrimination, digital evidence requirements, cross-complaints).
6. STRUCTURED COUNSEL FORMAT:
   Structure your consultations clearly using markdown:
   - **Executive Assessment**: Summary of exposure and immediate legal risk.
   - **Applicable Statutes & Penal Liability**: Specific sections, elements of the offense, and penalties.
   - **Classification of Offenses**: Cognizability, bailability, compoundability.
   - **Procedural Trajectory**: What to expect (FIR, police notices, arrest risk).
   - **Strategic Counsel & Immediate Action Plan**: Concrete steps to mitigate risk, pre-arrest legal remedies, and defense positioning.

Speak with confidence, authoritative legal acumen, and tactical sharpness."""


class RAGService:
    """Retrieval-Augmented Generation pipeline for legal Q&A."""

    def __init__(self, vector_store: VectorStoreService) -> None:
        self._vector_store = vector_store
        self._llm = ChatOpenAI(
            model=settings.OPENAI_MODEL,
            temperature=0.1,
            openai_api_key=settings.OPENAI_API_KEY,
        )
        logger.info(
            "RAGService initialised — model=%s, max_docs=%d",
            settings.OPENAI_MODEL,
            settings.MAX_RETRIEVAL_DOCS,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def chat(
        self, messages: list[ChatMessage], session_id: Optional[str] = None
    ) -> ChatResponse:
        """Generate an answer using RAG.

        Steps:
          1. Extract the latest user message.
          2. Retrieve similar chunks from ChromaDB.
          3. Build a context block from retrieved chunks.
          4. Send system prompt + context + full conversation history to OpenAI.
          5. Return the answer along with source citations.
        """
        session_id = session_id or str(uuid.uuid4())

        # 1. Extract the latest user message for retrieval
        user_message = self._extract_latest_user_message(messages)
        if not user_message:
            return ChatResponse(
                answer="I didn't receive a question. Please try again.",
                sources=[],
                session_id=session_id,
            )

        # 2. Similarity search
        retrieved = self._vector_store.similarity_search(
            query=user_message, k=settings.MAX_RETRIEVAL_DOCS
        )

        # 3. Build context string and source list
        context_block, source_documents = self._build_context(retrieved)

        # 4. Construct the LangChain message list
        lc_messages = self._build_lc_messages(messages, context_block)

        # 5. Call the LLM
        try:
            response = await self._llm.ainvoke(lc_messages)
            answer = response.content
        except Exception as exc:
            logger.error("LLM call failed: %s", exc)
            raise RuntimeError(f"LLM call failed: {exc}") from exc

        return ChatResponse(
            answer=answer,
            sources=source_documents,
            session_id=session_id,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_latest_user_message(messages: list[ChatMessage]) -> str:
        """Return the text of the last message with role == 'user'."""
        for msg in reversed(messages):
            if msg.role == "user":
                return msg.content
        return ""

    @staticmethod
    def _build_context(
        retrieved: list[tuple],
    ) -> tuple[str, list[SourceDocument]]:
        """Build a context string and a list of SourceDocument citations.

        Args:
            retrieved: List of (Document, score) tuples from ChromaDB.

        Returns:
            A tuple of (formatted_context_string, list_of_SourceDocument).
        """
        if not retrieved:
            return "No relevant legal documents found in the knowledge base.", []

        context_parts: list[str] = []
        source_documents: list[SourceDocument] = []

        for i, (doc, score) in enumerate(retrieved, start=1):
            meta = doc.metadata
            title = meta.get("source", "Unknown document")
            page = meta.get("page")
            chunk_preview = doc.page_content[:300].strip()

            # Build context snippet
            page_info = f", page {page}" if page else ""
            context_parts.append(
                f"[Source {i}: {title}{page_info}]\n{doc.page_content.strip()}"
            )

            # Clamp score to [0, 1] — Chroma relevance scores can occasionally
            # exceed 1.0 due to floating-point arithmetic.
            relevance = max(0.0, min(1.0, float(score)))

            source_documents.append(
                SourceDocument(
                    title=title,
                    page=int(page) if page is not None else None,
                    chunk=chunk_preview,
                    relevance_score=round(relevance, 4),
                )
            )

        context_block = "\n\n---\n\n".join(context_parts)
        return context_block, source_documents

    @staticmethod
    def _build_lc_messages(
        messages: list[ChatMessage], context_block: str
    ) -> list:
        """Convert API ChatMessage list to LangChain message objects.

        The system message is prepended with the Saul persona and the
        retrieved context so the model always has grounding information.
        """
        system_content = (
            f"{SAUL_SYSTEM_PROMPT}\n\n"
            "--- RETRIEVED LEGAL CONTEXT (KNOWLEDGE BASE) ---\n"
            f"{context_block}\n"
            "--- END OF CONTEXT ---\n\n"
            "INSTRUCTIONS FOR YOUR LEGAL CONSULTATION:\n"
            "1. Ground your counsel firmly in the retrieved legal context above, citing specific sections, articles, and acts.\n"
            "2. Act as a strategic legal counsel advising a client: analyze statutory liability, classifications, procedural trajectory, and defense maneuvers.\n"
            "3. Do NOT lecture morally, scold, or offer relationship advice. Focus exclusively on the law, liabilities, evidence, and legal remedies."
        )

        lc_msgs = [SystemMessage(content=system_content)]

        for msg in messages:
            if msg.role == "user":
                lc_msgs.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                lc_msgs.append(AIMessage(content=msg.content))
            # Ignore system-role messages from the client (we set our own)

        return lc_msgs
