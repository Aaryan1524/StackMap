import os
import shutil
from git import Repo
from langchain_text_splitters import Language
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

# Map file extensions → LangChain Language enum
EXT_TO_LANGUAGE = {
    ".py":   Language.PYTHON,
    ".js":   Language.JS,
    ".jsx":  Language.JS,
    ".ts":   Language.TS,
    ".tsx":  Language.TS,
    ".go":   Language.GO,
    ".java": Language.JAVA,
    ".rb":   Language.RUBY,
    ".rs":   Language.RUST,
    ".cpp":  Language.CPP,
    ".cc":   Language.CPP,
    ".c":    Language.CPP,
    ".cs":   Language.CPP,   # best available approximation
}

# Directories to always skip
SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".nuxt", "coverage", ".mypy_cache",
}

def clone_repository(repo_url, local_path="./repo_data"):
    """Clones a GitHub repository, wiping any previous clone first."""
    if os.path.exists(local_path):
        shutil.rmtree(local_path)
    print(f"Cloning {repo_url} to {local_path}...")
    Repo.clone_from(repo_url, local_path)
    print("Cloning complete.")
    return local_path

def ingest_repo(repo_path):
    """
    Loads all supported code files from the repo and splits them
    using language-aware splitters.
    """
    print("Parsing repository (multi-language mode)...")
    # Group documents by language so we can use the right splitter
    by_language: dict[Language, list[Document]] = {}
    generic: list[Document] = []

    for root, dirs, files in os.walk(repo_path):
        # Prune ignored directories in-place
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext not in EXT_TO_LANGUAGE:
                continue

            full_path = os.path.join(root, file)
            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    content = f.read()
                doc = Document(page_content=content, metadata={"source": full_path})
                lang = EXT_TO_LANGUAGE[ext]
                by_language.setdefault(lang, []).append(doc)
            except UnicodeDecodeError:
                print(f"⚠️ Skipping binary file: {file}")
            except Exception as e:
                print(f"⚠️ Error reading {file}: {e}")

    total_docs = sum(len(v) for v in by_language.values()) + len(generic)
    print(f"Loaded {total_docs} files across {len(by_language)} language(s).")

    # Split each language group with its own splitter
    all_chunks: list[Document] = []
    for lang, docs in by_language.items():
        splitter = RecursiveCharacterTextSplitter.from_language(
            language=lang, chunk_size=2000, chunk_overlap=200
        )
        all_chunks.extend(splitter.split_documents(docs))

    print(f"Split into {len(all_chunks)} chunks.")
    return all_chunks

if __name__ == "__main__":
    # Test Run
    test_repo = "https://github.com/hwchase17/langchain" 
    path = clone_repository(test_repo)
    chunks = ingest_repo(path)
    if chunks:
        print(f"\n✅ Success! First chunk content preview:\n{chunks[0].page_content[:200]}...")