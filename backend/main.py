from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.ingestion import clone_repository, ingest_repo
from src.vector_store import get_vector_store
from src.rag_chain import get_rag_chain
from src.graph import populate_graph, get_graph_data

app = FastAPI(title="StackMap API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store — will be replaced by Neo4j
ingested_repos: list[str] = []


class IngestRequest(BaseModel):
    repo_url: str


class QueryRequest(BaseModel):
    question: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest")
def ingest(request: IngestRequest):
    try:
        local_path = clone_repository(request.repo_url)
        chunks = ingest_repo(local_path)
        get_vector_store(chunks)
        try:
            populate_graph(local_path)
        except Exception as graph_err:
            print(f"⚠ Neo4j unavailable, skipping graph: {graph_err}")
        if request.repo_url not in ingested_repos:
            ingested_repos.append(request.repo_url)
        return {"status": "ok", "chunks_indexed": len(chunks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/repos")
def list_repos():
    return {"repos": ingested_repos}


@app.get("/graph")
def graph(limit: int = 2000):
    try:
        return get_graph_data(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query")
def query(request: QueryRequest):
    try:
        chain = get_rag_chain()
        result = chain.invoke({"input": request.question})
        sources = list({doc.metadata.get("source", "") for doc in result["context"]})
        return {"answer": result["answer"], "sources": sources}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
