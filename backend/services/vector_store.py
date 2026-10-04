"""ChromaDB vector store service.

Wraps langchain_chroma.Chroma with helper methods for document management
and similarity search used by the RAG pipeline.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from langchain_core.documents import Document
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

from config import settings

logger = logging.getLogger(__name__)

COLLECTION_NAME = "legal_documents"


class VectorStoreService:
    """Manages the ChromaDB persistent vector store."""

    def __init__(self) -> None:
        # Ensure the persistence directory exists
        Path(settings.CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)

        self._embeddings = OpenAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            openai_api_key=settings.OPENAI_API_KEY,
        )

        self._store = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=self._embeddings,
            persist_directory=settings.CHROMA_PERSIST_DIR,
        )
        logger.info(
            "VectorStoreService initialised — collection=%s, persist_dir=%s",
            COLLECTION_NAME,
            settings.CHROMA_PERSIST_DIR,
        )

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    def add_documents(self, docs: list[Document], source_name: str) -> int:
        """Embed and add *docs* to the store.

        Args:
            docs: Chunked LangChain Documents to add.
            source_name: Human-readable label stored in metadata["source"].

        Returns:
            Number of chunks actually added.
        """
        if not docs:
            return 0

        # Stamp the canonical source name so deletion works reliably
        for doc in docs:
            doc.metadata["source"] = source_name

        # ChromaDB has an internal SQLite limit of max 5461 variables per query.
        # Batch into slices of 500 chunks to safely handle large legal codes.
        BATCH_SIZE = 500
        for i in range(0, len(docs), BATCH_SIZE):
            batch = docs[i : i + BATCH_SIZE]
            self._store.add_documents(batch)
            logger.info(
                "Indexed chunks %d–%d of %d for '%s'",
                i + 1,
                min(i + BATCH_SIZE, len(docs)),
                len(docs),
                source_name,
            )

        logger.info("Successfully added all %d chunks from '%s'", len(docs), source_name)
        return len(docs)

    def delete_document(self, source_name: str) -> bool:
        """Delete all chunks whose metadata["source"] matches *source_name*.

        Returns:
            True if at least one chunk was deleted, False otherwise.
        """
        try:
            collection = self._store._collection  # access underlying chromadb collection
            results = collection.get(where={"source": source_name})
            ids = results.get("ids", [])
            if not ids:
                logger.warning("No chunks found for source '%s'", source_name)
                return False
            collection.delete(ids=ids)
            logger.info("Deleted %d chunks for source '%s'", len(ids), source_name)
            return True
        except Exception as exc:
            logger.error("Failed to delete '%s': %s", source_name, exc)
            return False

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    def similarity_search(
        self, query: str, k: Optional[int] = None
    ) -> list[tuple[Document, float]]:
        """Run a similarity search and return (document, score) pairs.

        Scores are cosine-distance values returned by Chroma; lower = more
        similar.  We convert to a 0-1 relevance score (1 = most relevant).
        """
        k = k or settings.MAX_RETRIEVAL_DOCS
        try:
            results = self._store.similarity_search_with_relevance_scores(query=query, k=k)
            return results
        except Exception as exc:
            logger.error("Similarity search failed: %s", exc)
            return []

    def get_document_count(self) -> int:
        """Return the total number of chunks stored in the collection."""
        try:
            return self._store._collection.count()
        except Exception as exc:
            logger.error("Failed to get document count: %s", exc)
            return 0

    def get_document_names(self) -> list[str]:
        """Return a deduplicated list of source document names."""
        try:
            collection = self._store._collection
            results = collection.get(include=["metadatas"])
            sources: set[str] = set()
            for meta in results.get("metadatas", []):
                if meta and "source" in meta:
                    sources.add(meta["source"])
            return sorted(sources)
        except Exception as exc:
            logger.error("Failed to get document names: %s", exc)
            return []

    def get_chunk_count_for_source(self, source_name: str) -> int:
        """Return the number of chunks stored for a specific source document."""
        try:
            collection = self._store._collection
            results = collection.get(where={"source": source_name})
            return len(results.get("ids", []))
        except Exception as exc:
            logger.error("Failed to get chunk count for '%s': %s", source_name, exc)
            return 0
