"""FastAPI application entry point for the Saul Legal AI Assistant.

Start the server:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import chat, documents
from services.document_processor import DocumentProcessor
from services.rag_service import RAGService
from services.vector_store import VectorStoreService

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Create shared service instances and data directories on startup."""
    # Ensure data directories exist
    Path(settings.DOCUMENTS_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)
    logger.info("Data directories ready.")

    # Initialise shared services (expensive — do once at startup)
    vector_store = VectorStoreService()
    document_processor = DocumentProcessor()
    rag_service = RAGService(vector_store=vector_store)

    # Attach to app state so routers can access them via Request.app.state
    app.state.vector_store = vector_store
    app.state.document_processor = document_processor
    app.state.rag_service = rag_service

    logger.info("🚀 Saul Legal AI Assistant is ready.")
    yield
    # Shutdown — nothing special needed for ChromaDB (it auto-persists)
    logger.info("Saul is shutting down.")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Saul - Legal AI Assistant",
    description=(
        "A RAG-powered legal chatbot backed by ChromaDB and OpenAI. "
        "Upload legal documents and ask Saul anything about them."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow the React dev servers (and any origins from config)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(chat.router, prefix="/api")
app.include_router(documents.router, prefix="/api")


# ---------------------------------------------------------------------------
# Root endpoint
# ---------------------------------------------------------------------------

@app.get("/", tags=["root"], summary="API information")
async def root() -> dict[str, str]:
    """Return basic API metadata."""
    return {
        "name": "Saul - Legal AI Assistant",
        "version": "1.0.0",
        "description": "RAG-powered legal chatbot — see /docs for the full API reference.",
        "docs": "/docs",
        "health": "/api/health",
    }
