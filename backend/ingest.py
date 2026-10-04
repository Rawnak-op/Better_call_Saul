import asyncio
import os
from pathlib import Path

# Set environment variables if needed, though config.py handles .env
from config import settings
from services.document_processor import DocumentProcessor
from services.vector_store import VectorStoreService

async def main():
    print("🚀 Starting local document ingestion...")
    
    docs_dir = Path(settings.DOCUMENTS_DIR)
    if not docs_dir.exists():
        print(f"Directory {docs_dir} does not exist. Please place PDFs there.")
        return

    vector_store = VectorStoreService()
    processor = DocumentProcessor()

    pdf_files = list(docs_dir.glob("*.pdf")) + list(docs_dir.glob("*.docx")) + list(docs_dir.glob("*.txt"))
    
    if not pdf_files:
        print("No documents found in backend/data/documents/")
        return

    for file_path in pdf_files:
        print(f"\nProcessing {file_path.name}...")
        try:
            print("  - Parsing text and chunking...")
            raw_docs = processor.process_file(file_path)
            chunks = processor.split_documents(raw_docs)
            print(f"  - Created {len(chunks)} chunks. Sending to Pinecone (this may take a while)...")
            
            chunks_added = vector_store.add_documents(chunks, source_name=file_path.name)
            print(f"✅ Successfully ingested {file_path.name} ({chunks_added} chunks) into Pinecone!")
        except Exception as e:
            print(f"❌ Failed to process {file_path.name}: {e}")

if __name__ == "__main__":
    asyncio.run(main())
