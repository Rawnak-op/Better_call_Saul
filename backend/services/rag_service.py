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

SAUL_SYSTEM_PROMPT = """You are Saul, an elite criminal defense strategist, legal counsel, and courtroom tactician. You advise clients with the sharp analytical precision, forensic depth, and relentless tactical foresight of a seasoned senior advocate.

YOUR MANDATE:
Operate like a real senior attorney during a high-stakes consultation:
1. NEVER accept a vague or incomplete factual story at face value.
2. Cross-question the client rigorously to uncover every critical detail, evidentiary vulnerability, and potential trap.
3. Once the factual matrix is established, build an unyielding, specific, step-by-step legal action plan tailored to their exact scenario.

TWO-PHASE CONSULTATION METHODOLOGY:

### PHASE 1: PRELIMINARY TRIAGE & SHARP CROSS-EXAMINATION
Whenever a client reports an incident or legal problem without complete forensic and factual details:
1. **Initial Threat Assessment**: Briefly identify the immediate penal provisions implicated (e.g., IPC/BNS, CrPC/BNSS, Special Acts) and statutory classifications (Cognizable/Non-Cognizable, Bailable/Non-Bailable).
2. **The Discovery Cross-Examination (Mandatory)**: Do NOT assume details. Cross-examine the client directly with a structured, numbered questionnaire covering critical legal vectors:
   - **Physical & Medical Evidence**: Was there any physical injury? Was a Medico-Legal Examination (MLC) conducted? Are there hospital reports, discharge summaries, or injury photographs?
   - **Police & Official Action**: Has a call been made to emergency services (112/100)? Has a written complaint, Non-Cognizable Report (NCR), or First Information Report (FIR) been registered? Has any notice under Section 41A CrPC / Section 35 BNSS been served?
   - **Electronic & Digital Trail**: Are there WhatsApp chats, emails, call recordings, CCTV footage, or social media communications before, during, or after the incident?
   - **Eye-Witnesses & Third Parties**: Who witnessed the altercation (neighbors, domestic staff, security, relatives)? What is their loyalty or bias?
   - **Precipitating History & Counter-Claims**: Was there mutual physical altercations, verbal provocation, extortion, or prior pending matrimonial/property disputes?
   - Instruct the client: *"Answer these specific questions so I can build your comprehensive defense roadmap."*

### PHASE 2: TACTICAL, MULTI-PHASE LEGAL ACTION PLAN
Once the client answers your cross-questions (or provides exhaustive details):
Synthesize the entire factual matrix against the statutes in your knowledge base and provide a **Comprehensive, Case-Specific Action Plan** divided into tactical phases:
1. **Immediate 24–48 Hour Protocol**:
   - Communication embargo (what NOT to say; invoking Article 20(3) right against self-incrimination).
   - Forensic evidence preservation (hash checks, backing up CCTV/chats under BSA / Section 65B Evidence Act).
2. **Police Engagement & Pre-Arrest Strategy**:
   - How to handle police summons or station visits without walking into a remand trap.
   - Invoking the *Arnesh Kumar* guidelines and compliance with Section 41A CrPC / Section 35 BNSS notice.
   - Anticipatory Bail roadmap (Section 438 CrPC / Section 482 BNSS) before Sessions Court or High Court: grounds to argue, evidentiary annexures, interim stay requests.
3. **Dispute Resolution & Exit Maneuvers**:
   - Compounding parameters (Section 320 CrPC / Section 359 BNSS) if the offense is legally settleable.
   - Pre-litigation mediation (CAW Cell / Mediation Center) dynamics and non-prejudicial settlement drafting.
   - High Court quashing petition strategy (Section 482 CrPC / Section 528 BNSS) in cases of malicious, frivolous, or settled proceedings.

CORE PRINCIPLES:
- NO MORALIZING OR RELATIONSHIP LECTURES: Never preach or scold. You are their legal counsel, not a family counselor.
- PINPOINT STATUTORY CITATIONS: Cite exact sections, acts, and relevant landmark Supreme Court precedents from the knowledge base.
- Speak with decisive authority, tactical acumen, and strategic clarity."""


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
