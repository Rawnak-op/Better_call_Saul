"""Retrieval Evaluation Script for Saul - Legal AI Assistant

Evaluates retrieval quality against your live Pinecone knowledge base:
1. Context Precision / Relevance: Do the retrieved chunks contain relevant statutory information?
2. Recall@K (Hit Rate): Does the expected legal section / keyword appear in the Top K results?
3. Reciprocal Rank (MRR): Where in the Top K list does the target statute appear?
4. Cosine Similarity Distribution: What are the confidence scores across different query types?
"""
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# --- 1. Load Environment Configuration ---
def load_env(env_path: Path) -> dict:
    env = {}
    if not env_path.exists():
        raise FileNotFoundError(f"Missing .env file at {env_path}")
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env

backend_env = load_env(BASE_DIR / "backend" / ".env")
OPENAI_API_KEY = backend_env.get("OPENAI_API_KEY")
PINECONE_API_KEY = backend_env.get("PINECONE_API_KEY")
PINECONE_INDEX_NAME = backend_env.get("PINECONE_INDEX_NAME", "saul-legal-index")
EMBEDDING_MODEL = backend_env.get("EMBEDDING_MODEL", "text-embedding-3-small")

# --- 2. Lightweight API Clients (Pure standard library, zero extra pip dependencies) ---
def get_pinecone_host(api_key: str, index_name: str) -> str:
    """Discover index host URL from Pinecone control plane."""
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

def get_openai_embedding(text: str, api_key: str, model: str) -> list[float]:
    """Generate 1536-dim embedding vector via OpenAI API."""
    payload = json.dumps({"input": text, "model": model}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        return data["data"][0]["embedding"]

def query_pinecone(vector: list[float], top_k: int, host: str, api_key: str) -> list[dict]:
    """Execute cosine similarity search on Pinecone index."""
    payload = json.dumps({
        "vector": vector,
        "topK": top_k,
        "includeMetadata": True,
        "includeValues": False
    }).encode("utf-8")
    req = urllib.request.Request(
        f"https://{host}/query",
        data=payload,
        headers={
            "Api-Key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        matches = data.get("matches", [])
        # Filter out the dummy state tracking vector
        return [m for m in matches if m.get("id") != "__saul_doc_tracker__"]

# --- 3. Benchmark Dataset (Golden Test Suite) ---
# Tests core statutory scenarios across the Indian Penal Code (IPC) and criminal law:
BENCHMARK_TESTS = [
    {
        "id": "T01",
        "category": "Offenses Against Property",
        "query": "What is the definition and punishment for theft in Indian criminal law?",
        "expected_statutes": ["378", "379", "theft", "dishonestly"],
        "critical_keyword": "theft"
    },
    {
        "id": "T02",
        "category": "Offenses Affecting Life",
        "query": "What constitutes culpable homicide and how is murder defined?",
        "expected_statutes": ["299", "300", "culpable homicide", "murder"],
        "critical_keyword": "culpable homicide"
    },
    {
        "id": "T03",
        "category": "Offenses Affecting Life",
        "query": "What is the punishment for murder?",
        "expected_statutes": ["302", "death", "imprisonment for life"],
        "critical_keyword": "302"
    },
    {
        "id": "T04",
        "category": "Offenses Against Body",
        "query": "What is kidnapping and abduction?",
        "expected_statutes": ["359", "362", "kidnapping", "abduction"],
        "critical_keyword": "kidnapping"
    },
    {
        "id": "T05",
        "category": "Extortion & Robbery",
        "query": "What are the essential ingredients of extortion and when does it become robbery?",
        "expected_statutes": ["383", "390", "extortion", "robbery"],
        "critical_keyword": "extortion"
    },
    {
        "id": "T06",
        "category": "Cheating & Fraud",
        "query": "What is the punishment for cheating and dishonestly inducing delivery of property?",
        "expected_statutes": ["415", "420", "cheating"],
        "critical_keyword": "420"
    },
    {
        "id": "T07",
        "category": "Criminal Misappropriation",
        "query": "What constitutes dishonest misappropriation of property?",
        "expected_statutes": ["403", "405", "misappropriation", "breach of trust"],
        "critical_keyword": "misappropriation"
    },
    {
        "id": "T08",
        "category": "Defamation",
        "query": "How is criminal defamation defined and what are its exceptions?",
        "expected_statutes": ["499", "500", "defamation", "imputation"],
        "critical_keyword": "defamation"
    },
    {
        "id": "T09",
        "category": "Criminal Conspiracy & Abetment",
        "query": "What is criminal conspiracy and abetment of an offense?",
        "expected_statutes": ["107", "120A", "120B", "conspiracy", "abetment"],
        "critical_keyword": "conspiracy"
    },
    {
        "id": "T10",
        "category": "Out-of-Domain Control Test",
        "query": "How do I bake a chocolate cake at home with butter and sugar?",
        "expected_statutes": [],  # Negative control test: Should NOT match with high similarity
        "critical_keyword": None
    }
]

# --- 4. Evaluation Runner ---
def run_evaluation(top_k: int = 5):
    print("=" * 80)
    print("  SAUL LEGAL RAG - RETRIEVAL EVALUATION SUITE")
    print("=" * 80)
    print(f"Index: {PINECONE_INDEX_NAME} | Embedding: {EMBEDDING_MODEL} | Top-K: {top_k}\n")

    host = get_pinecone_host(PINECONE_API_KEY, PINECONE_INDEX_NAME)
    print(f"[OK] Discovered Pinecone Host: {host}\n")

    total_legal_queries = 0
    hits = 0
    reciprocal_ranks = []
    relevance_scores_legal = []
    relevance_scores_ood = []
    detailed_results = []

    for item in BENCHMARK_TESTS:
        tid = item["id"]
        query = item["query"]
        category = item["category"]
        expected = item["expected_statutes"]
        critical = item["critical_keyword"]

        print(f"--- Running {tid} [{category}] ---")
        print(f"Query: \"{query}\"")

        # 1. Embed query
        query_vector = get_openai_embedding(query, OPENAI_API_KEY, EMBEDDING_MODEL)

        # 2. Retrieve top-k
        matches = query_pinecone(query_vector, top_k, host, PINECONE_API_KEY)

        # 3. Analyze matches
        first_hit_rank = None
        matched_statutes = set()

        scores = [m.get("score", 0.0) for m in matches]
        print(f"Top-{top_k} Cosine Scores: {[round(s, 4) for s in scores]}")

        if category == "Out-of-Domain Control Test":
            relevance_scores_ood.extend(scores)
            avg_ood = sum(scores) / len(scores) if scores else 0.0
            print(f"Negative Control Avg Score: {avg_ood:.4f} (Baseline for rejection threshold)")
            detailed_results.append({
                "id": tid,
                "category": category,
                "hit": None,
                "top_score": round(max(scores) if scores else 0.0, 4),
                "notes": "Negative control test"
            })
            print()
            continue

        total_legal_queries += 1
        relevance_scores_legal.extend(scores)

        for rank, match in enumerate(matches, start=1):
            metadata = match.get("metadata", {})
            text = metadata.get("text", "") or metadata.get("chunk", "") or metadata.get("page_content", "")
            text_lower = text.lower()

            for stat in expected:
                if stat.lower() in text_lower:
                    matched_statutes.add(stat)
                    if first_hit_rank is None:
                        first_hit_rank = rank

        is_hit = (first_hit_rank is not None)
        if is_hit:
            hits += 1
            rr = 1.0 / first_hit_rank
            reciprocal_ranks.append(rr)
            status_symbol = "HIT"
        else:
            reciprocal_ranks.append(0.0)
            status_symbol = "MISS"

        top_score = scores[0] if scores else 0.0
        print(f"Result: [{status_symbol}] | First Hit Rank: {first_hit_rank or 'N/A'} | Top Score: {top_score:.4f}")
        print(f"Matched terms: {list(matched_statutes) if matched_statutes else 'None'}\n")

        detailed_results.append({
            "id": tid,
            "category": category,
            "hit": is_hit,
            "first_hit_rank": first_hit_rank,
            "top_score": round(top_score, 4),
            "matched": list(matched_statutes)
        })

    # --- 5. Metrics Aggregation ---
    recall_at_k = (hits / total_legal_queries) * 100 if total_legal_queries else 0.0
    mrr = sum(reciprocal_ranks) / len(reciprocal_ranks) if reciprocal_ranks else 0.0
    avg_legal_similarity = sum(relevance_scores_legal) / len(relevance_scores_legal) if relevance_scores_legal else 0.0
    avg_ood_similarity = sum(relevance_scores_ood) / len(relevance_scores_ood) if relevance_scores_ood else 0.0

    print("=" * 80)
    print("                     EVALUATION REPORT SUMMARY")
    print("=" * 80)
    print(f"Total Benchmark Queries Tested : {len(BENCHMARK_TESTS)}")
    print(f"Domain-Specific Legal Queries  : {total_legal_queries}")
    print(f"Recall@{top_k} (Hit Rate)           : {recall_at_k:.1f}% ({hits}/{total_legal_queries})")
    print(f"Mean Reciprocal Rank (MRR)     : {mrr:.4f} (How close hits are to Rank 1)")
    print(f"Avg Legal Cosine Similarity    : {avg_legal_similarity:.4f}")
    print(f"Avg Out-of-Domain Similarity   : {avg_ood_similarity:.4f}")
    print(f"Separation Margin (Signal/Noise): {(avg_legal_similarity - avg_ood_similarity):.4f}")
    print("=" * 80)

    # Save artifact for user and interview reference
    report_data = {
        "recall_at_k": round(recall_at_k, 2),
        "mrr": round(mrr, 4),
        "avg_legal_similarity": round(avg_legal_similarity, 4),
        "avg_ood_similarity": round(avg_ood_similarity, 4),
        "separation_margin": round(avg_legal_similarity - avg_ood_similarity, 4),
        "tests": detailed_results
    }
    with open(BASE_DIR / "evaluation_results.json", "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)
    print(f"\n[OK] Full benchmark metrics saved to: d:\\bettercallsaul\\evaluation_results.json")

if __name__ == "__main__":
    run_evaluation(top_k=5)
