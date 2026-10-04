"""Document processing service.

Handles parsing of PDF, DOCX, TXT, and HTML files into LangChain Documents,
then splits them into chunks ready for embedding.
"""
from __future__ import annotations

import logging
from pathlib import Path

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    BSHTMLLoader,
    Docx2txtLoader,
    PyPDFLoader,
    TextLoader,
)

from config import settings

logger = logging.getLogger(__name__)

# Supported MIME/extension mapping
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".html", ".htm"}


class DocumentProcessor:
    """Parses and chunks documents for ingestion into the vector store."""

    def __init__(self) -> None:
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            separators=["\n\n", "\n", ". ", " ", ""],
            length_function=len,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process_file(self, file_path: Path) -> list[Document]:
        """Detect file type, parse the file, and return raw Documents."""
        suffix = file_path.suffix.lower()
        if suffix not in SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file type '{suffix}'. "
                f"Supported types: {', '.join(SUPPORTED_EXTENSIONS)}"
            )

        parser_map = {
            ".pdf": self._parse_pdf,
            ".docx": self._parse_docx,
            ".txt": self._parse_txt,
            ".html": self._parse_html,
            ".htm": self._parse_html,
        }

        logger.info("Parsing %s (type=%s)", file_path.name, suffix)
        docs = parser_map[suffix](file_path)

        # Enrich metadata on every document
        for doc in docs:
            doc.metadata.setdefault("source", file_path.name)
            doc.metadata.setdefault("file_type", suffix.lstrip("."))

        return docs

    def split_documents(self, docs: list[Document]) -> list[Document]:
        """Split raw documents into smaller chunks for embedding."""
        chunks = self._splitter.split_documents(docs)
        logger.info("Split %d documents into %d chunks", len(docs), len(chunks))
        return chunks

    # ------------------------------------------------------------------
    # Private parsers
    # ------------------------------------------------------------------

    def _parse_pdf(self, file_path: Path) -> list[Document]:
        """Load a PDF file page-by-page using PyPDFLoader."""
        try:
            loader = PyPDFLoader(str(file_path))
            docs = loader.load()
            # PyPDFLoader sets metadata["page"] as 0-based; convert to 1-based
            for doc in docs:
                if "page" in doc.metadata:
                    doc.metadata["page"] = int(doc.metadata["page"]) + 1
            return docs
        except Exception as exc:
            logger.error("Failed to parse PDF %s: %s", file_path, exc)
            raise RuntimeError(f"PDF parsing failed: {exc}") from exc

    def _parse_docx(self, file_path: Path) -> list[Document]:
        """Load a DOCX file using Docx2txtLoader."""
        try:
            loader = Docx2txtLoader(str(file_path))
            docs = loader.load()
            for doc in docs:
                doc.metadata["file_type"] = "docx"
            return docs
        except Exception as exc:
            logger.error("Failed to parse DOCX %s: %s", file_path, exc)
            raise RuntimeError(f"DOCX parsing failed: {exc}") from exc

    def _parse_txt(self, file_path: Path) -> list[Document]:
        """Load a plain-text file."""
        try:
            loader = TextLoader(str(file_path), encoding="utf-8")
            docs = loader.load()
            for doc in docs:
                doc.metadata["file_type"] = "txt"
            return docs
        except UnicodeDecodeError:
            # Fallback to latin-1 for legacy files
            loader = TextLoader(str(file_path), encoding="latin-1")
            docs = loader.load()
            for doc in docs:
                doc.metadata["file_type"] = "txt"
            return docs
        except Exception as exc:
            logger.error("Failed to parse TXT %s: %s", file_path, exc)
            raise RuntimeError(f"TXT parsing failed: {exc}") from exc

    def _parse_html(self, file_path: Path) -> list[Document]:
        """Load an HTML file, stripping tags via BSHTMLLoader."""
        try:
            loader = BSHTMLLoader(str(file_path), open_encoding="utf-8")
            docs = loader.load()
            for doc in docs:
                doc.metadata["file_type"] = "html"
            return docs
        except Exception as exc:
            logger.error("Failed to parse HTML %s: %s", file_path, exc)
            raise RuntimeError(f"HTML parsing failed: {exc}") from exc
