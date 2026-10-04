"""Pinecone vector store service.

Wraps langchain_pinecone.PineconeVectorStore with helper methods for document management
and similarity search used by the RAG pipeline.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from langchain_core.documents import Document
from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings
from pinecone import Pinecone

from config import settings

logger = logging.getLogger(__name__)

# We use a special ID to store document metadata tracking in Pinecone
TRACKER_ID = "__saul_doc_tracker__"

class VectorStoreService:
    """Manages the Pinecone persistent vector store."""

    def __init__(self) -> None:
        self._pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        self._index = self._pc.Index(settings.PINECONE_INDEX_NAME)
        
        self._embeddings = OpenAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            openai_api_key=settings.OPENAI_API_KEY,
        )

        self._store = PineconeVectorStore(
            index_name=settings.PINECONE_INDEX_NAME,
            embedding=self._embeddings,
            pinecone_api_key=settings.PINECONE_API_KEY,
            text_key="text",
        )
        logger.info(
            "VectorStoreService initialised — index=%s",
            settings.PINECONE_INDEX_NAME,
        )

    def _get_tracker_data(self) -> dict:
        """Fetch the tracking metadata dictionary from Pinecone."""
        try:
            resp = self._index.fetch(ids=[TRACKER_ID])
            if TRACKER_ID in resp.vectors:
                meta = resp.vectors[TRACKER_ID].metadata
                if "data" in meta:
                    return json.loads(meta["data"])
        except Exception as e:
            logger.error("Failed to fetch tracker: %s", e)
        return {}

    def _save_tracker_data(self, data: dict):
        """Save the tracking metadata dictionary to Pinecone as a dummy vector."""
        try:
            # Create a dummy vector of 1536 dims (matching text-embedding-3-small)
            dummy_vector = [0.0001] * 1536  # small non-zero to avoid div-by-zero math errors
            self._index.upsert(
                vectors=[
                    {
                        "id": TRACKER_ID,
                        "values": dummy_vector,
                        "metadata": {"data": json.dumps(data), "source": "TRACKER"}
                    }
                ]
            )
        except Exception as e:
            logger.error("Failed to save tracker: %s", e)

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    def add_documents(self, docs: list[Document], source_name: str) -> int:
        """Embed and add *docs* to the store."""
        if not docs:
            return 0
            
        for doc in docs:
            doc.metadata["source"] = source_name

        BATCH_SIZE = 100
        for i in range(0, len(docs), BATCH_SIZE):
            batch = docs[i : i + BATCH_SIZE]
            self._store.add_documents(batch)
            logger.info(
                "Indexed chunks %d–%d of %d for '%s'", 
                i + 1, min(i + BATCH_SIZE, len(docs)), len(docs), source_name
            )

        # Update tracker
        data = self._get_tracker_data()
        data[source_name] = len(docs)
        self._save_tracker_data(data)

        logger.info("Successfully added all %d chunks from '%s'", len(docs), source_name)
        return len(docs)

    def delete_document(self, source_name: str) -> bool:
        """Delete all chunks whose metadata["source"] matches *source_name*."""
        try:
            # Delete vectors using filter
            # Wait, Pinecone VectorStore delete uses 'filter' kwarg in Langchain or direct index delete.
            # Langchain's delete() with filter isn't fully supported in all versions, 
            # let's use the Pinecone index directly for deletion by filter.
            self._index.delete(filter={"source": {"$eq": source_name}})
            
            # Update tracker
            data = self._get_tracker_data()
            if source_name in data:
                del data[source_name]
                self._save_tracker_data(data)
                
            logger.info("Deleted chunks for source '%s'", source_name)
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
        """Run a similarity search and return (document, score) pairs."""
        k = k or settings.MAX_RETRIEVAL_DOCS
        try:
            results = self._store.similarity_search_with_relevance_scores(query=query, k=k)
            # Filter out tracker if it somehow surfaces
            return [res for res in results if res[0].metadata.get("source") != "TRACKER"]
        except Exception as exc:
            logger.error("Similarity search failed: %s", exc)
            return []

    def get_document_count(self) -> int:
        """Return the total number of chunks stored in the collection."""
        try:
            stats = self._index.describe_index_stats()
            # Note: total count includes the 1 tracker vector, but that's negligible
            return stats.total_vector_count
        except Exception as exc:
            logger.error("Failed to get document count: %s", exc)
            return 0

    def get_document_names(self) -> list[str]:
        """Return a deduplicated list of source document names."""
        data = self._get_tracker_data()
        return sorted(list(data.keys()))

    def get_chunk_count_for_source(self, source_name: str) -> int:
        """Return the number of chunks stored for a specific source document."""
        data = self._get_tracker_data()
        return data.get(source_name, 0)
