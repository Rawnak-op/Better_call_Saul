"""Pydantic request/response schemas for the Saul legal chatbot API."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Chat schemas
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    """A single turn in the conversation."""

    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Text of the message")


class ChatRequest(BaseModel):
    """Payload sent by the frontend to the /api/chat endpoint."""

    messages: list[ChatMessage] = Field(
        ..., description="Full conversation history including the latest user message"
    )
    session_id: Optional[str] = Field(
        default=None, description="Optional client-supplied session identifier"
    )


class SourceDocument(BaseModel):
    """A single retrieved document chunk surfaced as a citation."""

    title: str = Field(..., description="Source filename or document title")
    page: Optional[int] = Field(default=None, description="Page number within the source, if known")
    chunk: str = Field(..., description="Preview of the retrieved text chunk")
    relevance_score: float = Field(..., description="Cosine similarity score (0-1)")


class ChatResponse(BaseModel):
    """Payload returned by the /api/chat endpoint."""

    answer: str = Field(..., description="The model's answer")
    sources: list[SourceDocument] = Field(
        default_factory=list, description="Documents used to construct the answer"
    )
    session_id: str = Field(..., description="Session identifier (echoed or newly generated)")


# ---------------------------------------------------------------------------
# Document schemas
# ---------------------------------------------------------------------------

class DocumentUploadResponse(BaseModel):
    """Returned after a successful document upload and ingestion."""

    filename: str
    status: str
    chunks_created: int
    message: str


class DocumentInfo(BaseModel):
    """Metadata about a single ingested document."""

    filename: str
    file_type: str
    upload_date: str
    chunk_count: int


class DocumentListResponse(BaseModel):
    """List of all ingested documents."""

    documents: list[DocumentInfo]


# ---------------------------------------------------------------------------
# Health schema
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    """API health-check response."""

    status: str
    vector_db_status: str
    document_count: int
