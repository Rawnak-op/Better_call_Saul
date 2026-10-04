"""Chat router — /api/chat and /api/health endpoints."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status

from models.schemas import ChatRequest, ChatResponse, HealthResponse
from services.rag_service import RAGService
from services.vector_store import VectorStoreService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------

def get_vector_store(request: Request) -> VectorStoreService:
    """Pull the shared VectorStoreService from app state."""
    return request.app.state.vector_store


def get_rag_service(request: Request) -> RAGService:
    """Pull the shared RAGService from app state."""
    return request.app.state.rag_service


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Send a message and receive a RAG-powered legal response",
)
async def chat(
    payload: ChatRequest,
    rag_service: RAGService = Depends(get_rag_service),
) -> ChatResponse:
    """Process a chat request through the RAG pipeline.

    - Retrieves relevant legal document chunks from ChromaDB.
    - Sends the conversation + retrieved context to OpenAI.
    - Returns the answer with source citations.
    """
    if not payload.messages:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="messages list cannot be empty",
        )

    try:
        response = await rag_service.chat(
            messages=payload.messages, session_id=payload.session_id
        )
        return response
    except RuntimeError as exc:
        logger.error("RAG pipeline error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate response: {exc}",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error in /api/chat")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again.",
        ) from exc


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check for the API and vector store",
)
async def health(
    vector_store: VectorStoreService = Depends(get_vector_store),
) -> HealthResponse:
    """Return the health status of the API and ChromaDB."""
    try:
        doc_count = vector_store.get_document_count()
        vector_db_status = "ok"
    except Exception as exc:
        logger.error("Vector store health check failed: %s", exc)
        doc_count = 0
        vector_db_status = f"error: {exc}"

    return HealthResponse(
        status="ok",
        vector_db_status=vector_db_status,
        document_count=doc_count,
    )
