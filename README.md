# ⚖️ Saul — Legal AI Assistant

> A RAG-based legal chatbot powered by GPT-4o, ChromaDB, FastAPI, and React.  
> Upload constitutions, law books, and legal documents — then ask Saul anything.

![Saul Legal AI](https://img.shields.io/badge/Saul-Legal%20AI-d4a843?style=for-the-badge&logo=scales&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![OpenAI](https://img.shields.io/badge/GPT--4o-OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)

---

## 🏗️ Architecture

```
┌──────────────────────┐     HTTP/REST      ┌──────────────────────────┐
│   React Frontend     │ ◄────────────────► │   FastAPI Backend        │
│   Port 5173          │                    │   Port 8000              │
│                      │                    │                          │
│  • Chat UI           │                    │  • RAG Pipeline          │
│  • Doc Upload        │                    │  • Document Processor    │
│  • Knowledge Base    │                    │  • Vector Store          │
└──────────────────────┘                    └────────────┬─────────────┘
                                                         │
                                          ┌──────────────┼──────────────┐
                                          │              │              │
                                   ┌──────▼─────┐ ┌─────▼──────┐ ┌────▼──────┐
                                   │  ChromaDB  │ │  GPT-4o    │ │ Embeddings│
                                   │  (local)   │ │  (OpenAI)  │ │ text-3-sm │
                                   └────────────┘ └────────────┘ └───────────┘
```

### RAG Flow
1. 📤 **Ingest** — Upload PDF/DOCX/TXT/HTML → chunk → embed → store in ChromaDB
2. 🔍 **Retrieve** — User query → semantic similarity search → top-K relevant chunks
3. 🤖 **Generate** — GPT-4o receives context + conversation history → legal answer with citations

---

## 📁 Project Structure

```
bettercallsaul/
├── backend/                    # FastAPI Python backend
│   ├── main.py                 # App entry point
│   ├── config.py               # Settings (pydantic-settings)
│   ├── requirements.txt        # Python dependencies
│   ├── .env.example            # Environment template
│   ├── routers/
│   │   ├── chat.py             # POST /api/chat, GET /api/health
│   │   └── documents.py        # CRUD for legal documents
│   ├── services/
│   │   ├── rag_service.py      # Core RAG pipeline
│   │   ├── document_processor.py  # PDF/DOCX/TXT/HTML parsers
│   │   └── vector_store.py     # ChromaDB wrapper
│   ├── models/
│   │   └── schemas.py          # Pydantic request/response models
│   └── data/
│       ├── documents/          # Raw uploaded files
│       └── chroma_db/          # Persistent vector store
│
├── frontend/                   # React + Vite + TailwindCSS
│   ├── src/
│   │   ├── App.jsx             # Root layout
│   │   ├── api/client.js       # Fetch-based API client
│   │   ├── hooks/
│   │   │   ├── useChat.js      # Chat state & logic
│   │   │   └── useDocuments.js # Document management
│   │   └── components/
│   │       ├── Chat/           # ChatWindow, MessageBubble, SourceCard, TypingIndicator
│   │       ├── Sidebar/        # Sidebar, DocumentList
│   │       └── Upload/         # DocumentUpload (drag & drop)
│   └── package.json
│
├── start.ps1                   # Windows: start both servers
├── start.sh                    # Linux/Mac: start both servers
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- An OpenAI API key

### 1. Clone & Setup

```bash
git clone <repo>
cd bettercallsaul
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env       # Windows
# cp .env.example .env       # Mac/Linux

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-...

# Start the backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend API docs: http://localhost:8000/docs

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
copy .env.example .env       # Windows
# cp .env.example .env       # Mac/Linux

# Start the frontend
npm run dev
```

Frontend: http://localhost:5173

### 4. One-Command Start (Windows)

```powershell
.\start.ps1
```

---

## ⚙️ Configuration

Edit `backend/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | *(required)* | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o` | LLM model to use |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model |
| `CHUNK_SIZE` | `1000` | Document chunk size (tokens) |
| `CHUNK_OVERLAP` | `200` | Overlap between chunks |
| `MAX_RETRIEVAL_DOCS` | `5` | Top-K docs to retrieve per query |

---

## 📄 Supported Document Formats

| Format | Extension | Parser |
|--------|-----------|--------|
| PDF | `.pdf` | PyPDFLoader (LangChain) |
| Word | `.docx` | Docx2txtLoader |
| Plain Text | `.txt` | TextLoader |
| HTML | `.html`, `.htm` | BSHTMLLoader |

Max file size: **50 MB**

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | API info |
| `GET` | `/api/health` | Health check + document count |
| `POST` | `/api/chat` | Send a message, get RAG response |
| `POST` | `/api/documents/upload` | Upload & index a legal document |
| `GET` | `/api/documents` | List all indexed documents |
| `DELETE` | `/api/documents/{filename}` | Remove a document |

### Example Chat Request

```json
POST /api/chat
{
  "messages": [
    { "role": "user", "content": "What does the First Amendment protect?" }
  ],
  "session_id": "abc-123"
}
```

### Example Chat Response

```json
{
  "answer": "The First Amendment to the U.S. Constitution protects...",
  "sources": [
    {
      "title": "US_Constitution.pdf",
      "page": 3,
      "chunk": "Congress shall make no law respecting an establishment of religion...",
      "relevance_score": 0.94
    }
  ],
  "session_id": "abc-123"
}
```

---

## 💡 Tips for Best Results

- **Chunk your documents well** — large PDFs are automatically split into overlapping chunks
- **Upload multiple legal sources** — Saul will synthesize across all of them
- **Be specific in questions** — "What is the punishment for theft under IPC Section 379?" works better than "Tell me about theft"
- **Saul always cites sources** — check the Legal Sources panel to verify the answer

---

## ⚠️ Disclaimer

> Saul provides legal **information** based on uploaded documents. It is **not** a substitute for professional legal advice. Always consult a qualified attorney for specific legal matters.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TailwindCSS, react-markdown |
| Backend | Python, FastAPI, uvicorn |
| RAG Pipeline | LangChain, langchain-openai, langchain-chroma |
| Vector DB | ChromaDB (local persistent) |
| LLM | OpenAI GPT-4o |
| Embeddings | OpenAI text-embedding-3-small |
| Document Parsing | PyPDF, python-docx, BeautifulSoup4 |
