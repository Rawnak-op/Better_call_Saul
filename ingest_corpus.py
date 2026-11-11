import json
import os
import sys
import time
import uuid
import urllib.request
import urllib.error
from pathlib import Path
import pypdf

BASE_DIR = Path(__file__).resolve().parent

def load_env(env_path: Path) -> dict:
    env = {}
    if not env_path.exists():
        raise FileNotFoundError(f"Missing .env file at {env_path}")
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip("'\"")
    return env

backend_env = load_env(BASE_DIR / "backend" / ".env")
OPENAI_API_KEY = backend_env.get("OPENAI_API_KEY")
PINECONE_API_KEY = backend_env.get("PINECONE_API_KEY")
PINECONE_INDEX_NAME = backend_env.get("PINECONE_INDEX_NAME", "saul-legal-index")
EMBEDDING_MODEL = backend_env.get("EMBEDDING_MODEL", "text-embedding-3-small")

def get_pinecone_host(api_key: str, index_name: str) -> str:
    req = urllib.request.Request(
        "https://api.pinecone.io/indexes",
        headers={"Api-Key": api_key, "Accept": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        indexes = data.get("indexes", [])
        for idx in indexes:
            if idx.get("name") == index_name:
                return idx.get("host")
    raise ValueError(f"Index '{index_name}' not found in Pinecone account.")

def get_openai_embeddings_batch(texts: list[str], api_key: str, model: str) -> list[list[float]]:
    payload = json.dumps({"input": texts, "model": model}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    )
    # Retry on transient errors
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode())
                # Ensure ordered embeddings
                return [item["embedding"] for item in sorted(data["data"], key=lambda x: x["index"])]
        except Exception as e:
            if attempt < 3:
                time.sleep(2 * (attempt + 1))
            else:
                raise e

def upsert_pinecone_batch(vectors: list[dict], host: str, api_key: str):
    payload = json.dumps({"vectors": vectors}).encode("utf-8")
    req = urllib.request.Request(
        f"https://{host}/vectors/upsert",
        data=payload,
        headers={
            "Api-Key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            if attempt < 3:
                time.sleep(2 * (attempt + 1))
            else:
                raise e

def fetch_tracker(host: str, api_key: str) -> dict:
    try:
        req = urllib.request.Request(
            f"https://{host}/vectors/fetch?ids=__saul_doc_tracker__",
            headers={"Api-Key": api_key, "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            res = json.loads(resp.read().decode())
            vecs = res.get("vectors", {})
            if "__saul_doc_tracker__" in vecs:
                meta = vecs["__saul_doc_tracker__"].get("metadata", {})
                if "data" in meta:
                    return json.loads(meta["data"])
    except Exception as e:
        print(f"Notice: could not fetch existing tracker ({e})")
    return {}

def save_tracker(data: dict, host: str, api_key: str):
    dummy_vec = [0.0001] * 1536
    vector = {
        "id": "__saul_doc_tracker__",
        "values": dummy_vec,
        "metadata": {
            "data": json.dumps(data),
            "source": "TRACKER"
        }
    }
    upsert_pinecone_batch([vector], host, api_key)
    print("  [Tracker Updated]:", data)

def split_text(text: str, chunk_size=1000, chunk_overlap=200) -> list[str]:
    chunks = []
    start = 0
    clean = text.replace("\r\n", "\n").replace("\r", "\n")
    while start < len(clean):
        end = start + chunk_size
        chunk = clean[start:end]
        if end < len(clean):
            last_break = max(chunk.rfind("\n\n"), chunk.rfind("\n"), chunk.rfind(". "), chunk.rfind(" "))
            if last_break > chunk_size // 2:
                chunk = chunk[:last_break + 1]
                end = start + len(chunk)
        stripped = chunk.strip()
        if stripped:
            chunks.append(stripped)
        start = end - chunk_overlap
        if start >= len(clean) or end >= len(clean):
            break
    return chunks

def process_and_ingest_document(pdf_name: str, host: str):
    file_path = BASE_DIR / "backend" / "data" / "documents" / pdf_name
    if not file_path.exists():
        print(f"Error: {file_path} not found!")
        return 0

    print(f"\n========================================================")
    print(f"Indexing: {pdf_name}")
    print(f"========================================================")
    
    reader = pypdf.PdfReader(str(file_path))
    total_pages = len(reader.pages)
    print(f"  Total pages: {total_pages}")
    
    all_chunks = []
    for page_idx, page in enumerate(reader.pages):
        page_text = page.extract_text() or ""
        sub_chunks = split_text(page_text, chunk_size=1000, chunk_overlap=200)
        for c in sub_chunks:
            all_chunks.append({
                "text": c,
                "page": page_idx + 1,
                "file_type": "pdf",
                "source": pdf_name
            })
            
    total_chunks = len(all_chunks)
    print(f"  Generated {total_chunks} text chunks.")

    # Embed and upsert in batches of 64
    BATCH_SIZE = 64
    upserted_count = 0
    start_time = time.time()

    for i in range(0, total_chunks, BATCH_SIZE):
        batch = all_chunks[i : i + BATCH_SIZE]
        texts = [b["text"] for b in batch]
        
        # 1. Get embeddings
        embeddings = get_openai_embeddings_batch(texts, OPENAI_API_KEY, EMBEDDING_MODEL)
        
        # 2. Build Pinecone vector objects
        vectors = []
        for b, emb in zip(batch, embeddings):
            vectors.append({
                "id": str(uuid.uuid4()),
                "values": emb,
                "metadata": {
                    "text": b["text"],
                    "source": b["source"],
                    "page": b["page"],
                    "file_type": b["file_type"]
                }
            })
            
        # 3. Upsert to Pinecone
        upsert_pinecone_batch(vectors, host, PINECONE_API_KEY)
        upserted_count += len(vectors)
        pct = (upserted_count / total_chunks) * 100
        elapsed = time.time() - start_time
        print(f"  Progress: {upserted_count}/{total_chunks} chunks ({pct:.1f}%) [{elapsed:.1f}s elapsed]")

    print(f"Done indexing {pdf_name}: {upserted_count} vectors upserted.")
    return upserted_count

def main():
    host = get_pinecone_host(PINECONE_API_KEY, PINECONE_INDEX_NAME)
    print(f"Connected to Pinecone host: {host}")
    
    tracker_data = fetch_tracker(host, PINECONE_API_KEY)
    print(f"Current Tracker Data: {tracker_data}")
    
    docs_to_ingest = [
        "The_Indian_Evidence_Act_1872.pdf",
        "Bharatiya_Nyaya_Sanhita_2023.pdf",
        "Code_of_Criminal_Procedure_1973.pdf"
    ]
    
    for doc in docs_to_ingest:
        count = process_and_ingest_document(doc, host)
        tracker_data[doc] = count
        save_tracker(tracker_data, host, PINECONE_API_KEY)
        
    print("\nIngestion pipeline fully completed for all 3 legal statutes!")
    print(f"Final Tracker State: {tracker_data}")

if __name__ == "__main__":
    main()
