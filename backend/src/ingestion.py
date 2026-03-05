import os
import shutil
from git import Repo
from langchain_text_splitters import Language
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

def clone_repository(repo_url, local_path="./repo_data"):
    """
    Clones a GitHub repository to a local path.
    If the path exists, it wipes it first to ensure a fresh copy.
    """
    if os.path.exists(local_path):
        shutil.rmtree(local_path)
    
    print(f"Cloning {repo_url} to {local_path}...")
    Repo.clone_from(repo_url, local_path)
    print("Cloning complete.")
    return local_path

def ingest_repo(repo_path):
    """
    Loads code files from the repo and splits them using AST-aware parsing.
    Now includes 'Defensive Coding' to skip corrupt files.
    """
    print("Parsing repository (Fault Tolerant Mode)...")
    documents = []
    
    # 1. Load: Manually walk through files to handle encoding errors gracefully
    for root, _, files in os.walk(repo_path):
        for file in files:
            # We are targeting Python files for now
            if file.endswith(".py"):
                full_path = os.path.join(root, file)
                try:
                    with open(full_path, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    # Create a LangChain Document manually
                    doc = Document(
                        page_content=content, 
                        metadata={"source": full_path}
                    )
                    documents.append(doc)
                    
                except UnicodeDecodeError:
                    # This captures the error you saw in your screenshot
                    print(f"⚠️ Skipping corrupt/binary file: {file}")
                    continue
                except Exception as e:
                    print(f"⚠️ Error reading {file}: {e}")
                    continue

    print(f"Successfully loaded {len(documents)} documents.")

    # 2. Split: Respect code structure (classes, functions)
    # The AST magic happens here!
    python_splitter = RecursiveCharacterTextSplitter.from_language(
        language=Language.PYTHON, 
        chunk_size=2000, 
        chunk_overlap=200
    )
    
    texts = python_splitter.split_documents(documents)
    print(f"Split into {len(texts)} chunks.")
    
    return texts

if __name__ == "__main__":
    # Test Run
    test_repo = "https://github.com/hwchase17/langchain" 
    path = clone_repository(test_repo)
    chunks = ingest_repo(path)
    if chunks:
        print(f"\n✅ Success! First chunk content preview:\n{chunks[0].page_content[:200]}...")