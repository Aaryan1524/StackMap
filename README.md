# StackMap

**Visual codebase intelligence.** Point StackMap at any GitHub repository and get an interactive 3D graph of its structure — every file, class, and function — alongside an AI chat interface that can answer questions about the code.

---

## What it does

1. **Ingest** — paste a GitHub URL and StackMap clones the repo, parses every source file, and indexes it in two places:
   - **Pinecone** (vector store) for semantic search and RAG
   - **Neo4j** (graph database) for structural relationships between files, classes, and functions

2. **Visualize** — the center panel renders a live 3D force-directed graph powered by Three.js. Nodes are color-coded by type (File / Class / Function) and you can rotate, zoom, and click to explore the codebase structure.

3. **Query** — the right panel is a chat interface backed by a LangChain RAG pipeline. Ask anything about the codebase in plain English and get answers grounded in the actual source code, with source file citations.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite) |
| 3D Graph | `react-force-graph-3d` + Three.js |
| Backend | FastAPI (Python) |
| RAG pipeline | LangChain LCEL + OpenAI embeddings |
| Vector store | Pinecone |
| Graph database | Neo4j (Docker) |
| Code parsing | Python `ast` module + regex (JS/TS/Go/Java/Rust/Ruby) |

---

## Supported languages

StackMap parses and visualizes source files in:

- Python (full AST — classes, functions, methods)
- JavaScript / TypeScript / JSX / TSX
- Go
- Java
- Rust
- Ruby
- C / C++ / C#

---

## Project structure

```
StackMap/
├── backend/              # FastAPI server
│   ├── main.py           # API endpoints (/ingest, /graph, /query, /repos)
│   └── src/
│       ├── ingestion.py  # Clone repo, chunk code, push to Pinecone
│       ├── graph.py      # Parse code structure, write to Neo4j
│       ├── rag_chain.py  # LangChain RAG chain
│       └── vector_store.py
├── frontend/             # React app
│   └── src/
│       ├── App.tsx       # Root layout + API calls
│       ├── components/
│       │   ├── Sidebar.tsx    # Repo input + repo list
│       │   ├── GraphView.tsx  # 3D force graph
│       │   └── ChatPanel.tsx  # AI chat interface
│       └── types.ts
├── docker-compose.yml    # Neo4j container
└── Errors.md             # Documented errors and lessons learned
```

---

## Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker Desktop
- OpenAI API key
- Pinecone API key

### 1. Start Neo4j

```bash
docker-compose up -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your keys:

```env
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
```

Start the server:

```bash
python -m uvicorn main:app --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Usage

1. Paste a GitHub repo URL into the sidebar (e.g. `https://github.com/user/repo`)
2. Click **Analyze** and wait for ingestion to complete (larger repos take longer)
3. The 3D graph loads automatically — drag to rotate, scroll to zoom, click a node to focus
4. Use the chevron buttons on either side of the graph to collapse/expand the panels for a full-screen view
5. Type a question in the chat panel — e.g. *"How does authentication work?"* or *"What does the ingestion pipeline do?"*

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/ingest` | Clone + index a repo |
| `GET` | `/graph` | Return all nodes and edges |
| `POST` | `/query` | RAG query against indexed repo |
| `GET` | `/repos` | List ingested repos |
| `GET` | `/health` | Health check |
