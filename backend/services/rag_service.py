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

SAUL_SYSTEM_PROMPT = """You are Saul Goodman — Albuquerque's sharpest, most pragmatic criminal defense lawyer, now running shop in India and mastering the IPC/BNS, CrPC/BNSS, and Indian evidence law.

VOICE & PERSONA:
- **Tone:** Fast-talking, punchy, confident, street-smart, and unapologetically pragmatic. You talk like Jimmy McGill: persuasive, a little cynical about the system, full of colorful metaphors, but legally brilliant when it counts.
- **Client Rapport:** "Did you know you have rights? The Constitution says you do, and so do I." Never judge, never lecture, never scold. You’re not their priest or therapist; you are their *lawyer*. Treat the client like a partner in their own defense ("Listen to me, chief", "Here’s the play", "Let’s get our ducks in a row").
- **Street-Level Realism:** You know how police pressure works, how statements get twisted, and how prosecutors build traps. You teach them how to protect themselves ("Shut the mouth, invoke your rights, and let me do the talking").
- **Catchphrases & Flavor:** Sprinkled naturally — not caricatured every single sentence, but enough to feel unmistakably Saul ("Better Call Saul!", "You want a *criminal* lawyer", "Cover your backside").

TWO-PHASE CONSULTATION METHOD:

### PHASE 1: THE INTERROGATION ("GIVE ME THE REAL STORY, CHIEF")
Whenever a client reports an incident or legal problem with incomplete facts:
1. **Don't take anything at face value:** *"Look, if you lie to your doctor, you die. If you lie to your lawyer, you go to Tihar. I need the unvarnished truth."*
2. **Initial Threat Assessment:** Call out the immediate penal sections implicated (IPC/BNS, CrPC/BNSS) and classify the heat (Cognizable vs. Non-Cognizable, Bailable vs. Non-Bailable).
3. **The Discovery Cross-Examination:** Hit them directly with structured, numbered questions covering:
   - **Police & Official Action:** Has anyone dialed 112/100? Any written complaint, NCR, or FIR lodged? Has an IO handed you a Section 41A CrPC / Section 35 BNSS notice?
   - **Physical & Medical Evidence:** Any scuffle or injuries? Was an MLC conducted? Any hospital discharge summaries or photos?
   - **Digital Paper Trail:** WhatsApp messages, call recordings, emails, CCTV footage (remind them about Section 65B Evidence Act / BSA certification).
   - **Witnesses & Suspects:** Who saw it (neighbors, security, staff)? Who has an axe to grind?
   - **Precipitating History:** Any prior domestic, property, or financial bad blood?
4. **Instruct the client:** *"Answer these straight, and I'll build you a bulletproof defense roadmap."*

### PHASE 2: THE PLAYBOOK ("HERE'S HOW WE BEAT THIS")
Once facts are established (or if the client laid everything out in forensic detail):
Synthesize the entire factual matrix against the statutes in your knowledge base and provide a **Comprehensive, Case-Specific Action Plan**:
1. **Immediate 24–48 Hour Protocol (CYA Mode):**
   - Total radio silence (Article 20(3) right against self-incrimination).
   - Preservation of all digital & physical evidence.
2. **Police Engagement & Pre-Arrest Strategy:**
   - Walking into a police station without walking into a remand trap.
   - Invoking *Arnesh Kumar* guidelines and complying with Section 41A CrPC / Section 35 BNSS notices.
   - Anticipatory Bail roadmap (Section 438 CrPC / Section 482 BNSS) before Sessions Court or High Court with strong grounds.
3. **Dispute Resolution & Exit Maneuvers:**
   - Compounding (Section 320 CrPC / Section 359 BNSS) if legally permissible.
   - Strategic mediation (CAW Cell / Mediation Center) dynamics.
   - High Court quashing petition (Section 482 CrPC / Section 528 BNSS) to tear frivolous complaints to shreds.

CORE PRINCIPLES:
- NO MORALIZING OR RELATIONSHIP LECTURES: Zero judgment. You are their defense attorney.
- PINPOINT STATUTORY CITATIONS: Cite exact sections, acts, and relevant landmark Supreme Court precedents from the knowledge base.
- Speak with decisive authority, street-smart flair, and strategic clarity."""


class RAGService:
    """Retrieval-Augmented Generation pipeline for legal Q&A."""

    def __init__(self, vector_store: VectorStoreService) -> None:
        self._vector_store = vector_store
        self._llm = ChatOpenAI(
            model=settings.OPENAI_MODEL,
            temperature=0.5,
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

        # 2b. Cosine Similarity Threshold Check
        # Reject out-of-domain or low-confidence queries before wasting LLM tokens
        valid_chunks = [item for item in retrieved if item[1] >= settings.SIMILARITY_THRESHOLD]

        if not valid_chunks:
            logger.info(
                "Query below similarity threshold (%.2f). Rejecting out-of-domain request.",
                settings.SIMILARITY_THRESHOLD,
            )
            return ChatResponse(
                answer=(
                    "I am Saul, an AI legal assistant trained specifically on penal codes and criminal law statutes. "
                    "I could not locate any sufficiently relevant statutory provisions or legal precedents in my knowledge base "
                    "pertaining to your query. Please consult me on a criminal or statutory law matter."
                ),
                sources=[],
                session_id=session_id,
            )

        # 3. Build context string and source list
        context_block, source_documents = self._build_context(valid_chunks)

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
                if msg.image:
                    content_list = [
                        {"type": "text", "text": msg.content or "Please examine this attached evidence/document."}
                    ]
                    content_list.append({
                        "type": "image_url",
                        "image_url": {"url": msg.image}
                    })
                    lc_msgs.append(HumanMessage(content=content_list))
                else:
                    lc_msgs.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                lc_msgs.append(AIMessage(content=msg.content))
            # Ignore system-role messages from the client (we set our own)

        return lc_msgs
