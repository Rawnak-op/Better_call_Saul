"""Documents router — upload, list, and delete legal documents."""
from __future__ import annotations

import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from config import settings
from models.schemas import (
    DocumentInfo,
    DocumentListResponse,
    DocumentUploadResponse,
)
from services.document_processor import SUPPORTED_EXTENSIONS, DocumentProcessor
from services.vector_store import VectorStoreService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])

# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------

def get_vector_store(request: Request) -> VectorStoreService:
    return request.app.state.vector_store


def get_document_processor(request: Request) -> DocumentProcessor:
    return request.app.state.document_processor


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and ingest a legal document (PDF, DOCX, TXT, HTML)",
)
async def upload_document(
    file: UploadFile = File(..., description="Document file to upload and index"),
    vector_store: VectorStoreService = Depends(get_vector_store),
    processor: DocumentProcessor = Depends(get_document_processor),
) -> DocumentUploadResponse:
    """Persist a file to disk, parse it, chunk it, and add it to ChromaDB."""
    # --- Validate extension ---
    filename = file.filename or "unknown"
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"File type '{suffix}' is not supported. "
                f"Accepted types: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            ),
        )

    # --- Save file ---
    docs_dir = Path(settings.DOCUMENTS_DIR)
    docs_dir.mkdir(parents=True, exist_ok=True)
    dest_path = docs_dir / filename

    try:
        with dest_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info("Saved uploaded file: %s", dest_path)
    except Exception as exc:
        logger.error("Failed to save file '%s': %s", filename, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save file: {exc}",
        ) from exc
    finally:
        await file.close()

    # --- Parse + chunk ---
    try:
        raw_docs = processor.process_file(dest_path)
        chunks = processor.split_documents(raw_docs)
    except (ValueError, RuntimeError) as exc:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    # --- Add to vector store ---
    try:
        chunks_added = vector_store.add_documents(chunks, source_name=filename)
    except Exception as exc:
        dest_path.unlink(missing_ok=True)
        logger.error("Vector store ingestion failed for '%s': %s", filename, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to index document: {exc}",
        ) from exc

    return DocumentUploadResponse(
        filename=filename,
        status="success",
        chunks_created=chunks_added,
        message=f"Successfully processed '{filename}' into {chunks_added} searchable chunks.",
    )


@router.get(
    "",
    response_model=DocumentListResponse,
    summary="List all ingested documents",
)
async def list_documents(
    vector_store: VectorStoreService = Depends(get_vector_store),
) -> DocumentListResponse:
    """Return metadata for every document currently indexed in ChromaDB."""
    docs_dir = Path(settings.DOCUMENTS_DIR)
    source_names = vector_store.get_document_names()

    document_infos: list[DocumentInfo] = []
    for name in source_names:
        file_path = docs_dir / name
        suffix = Path(name).suffix.lower().lstrip(".")

        # Try to get the real modification date; fall back to now
        if file_path.exists():
            mtime = file_path.stat().st_mtime
            upload_date = datetime.fromtimestamp(mtime, tz=timezone.utc).strftime(
                "%Y-%m-%d %H:%M:%S UTC"
            )
        else:
            upload_date = "unknown"

        chunk_count = vector_store.get_chunk_count_for_source(name)
        document_infos.append(
            DocumentInfo(
                filename=name,
                file_type=suffix,
                upload_date=upload_date,
                chunk_count=chunk_count,
            )
        )

    return DocumentListResponse(documents=document_infos)


@router.delete(
    "/{filename}",
    summary="Remove a document from the vector store and disk",
    status_code=status.HTTP_200_OK,
)
async def delete_document(
    filename: str,
    vector_store: VectorStoreService = Depends(get_vector_store),
) -> dict[str, str]:
    """Delete all chunks for *filename* from ChromaDB and remove the file from disk."""
    # Remove from vector store
    deleted = vector_store.delete_document(filename)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{filename}' not found in the knowledge base.",
        )

    # Remove from disk (best-effort; don't fail if already gone)
    file_path = Path(settings.DOCUMENTS_DIR) / filename
    try:
        file_path.unlink(missing_ok=True)
        logger.info("Deleted file from disk: %s", file_path)
    except Exception as exc:
        logger.warning("Could not delete file from disk: %s — %s", file_path, exc)

    return {"message": f"Document '{filename}' successfully removed."}
