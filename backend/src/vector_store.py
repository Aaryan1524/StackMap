import os
import time
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec

# --- THE FIX: Load the .env file ---
load_dotenv()

def get_vector_store(chunks=None):
    """
    Initializes communication with Pinecone.
    """
    
    # 1. Configuration & Debugging
    api_key = os.getenv("PINECONE_API_KEY")
    
    # DEBUG CHECK: Stop immediately if key is missing
    if not api_key:
        print("❌ ERROR: PINECONE_API_KEY is missing!")
        print("Please check that your .env file is in the 'RepoChat' folder.")
        print(f"Current working directory: {os.getcwd()}")
        raise ValueError("API Key missing.")
        
    index_name = "repochat" 
    
    # Initialize Pinecone Client
    pc = Pinecone(api_key=api_key)

    # 2. Check if index exists (Idempotency)
    existing_indexes = [index.name for index in pc.list_indexes()]
    
    if index_name not in existing_indexes:
        print(f"Creating new index: {index_name}...")
        pc.create_index(
            name=index_name,
            dimension=1536, 
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1" 
            )
        )
        # Wait for index to initialize
        while not pc.describe_index(index_name).status['ready']:
            time.sleep(1)
        print("Index ready.")

    # 3. Define the Embedding Model
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

    # 4. Ingest or Connect
    if chunks:
        print(f"Embedding {len(chunks)} chunks to Pinecone... (This may take a minute)")
        vector_store = PineconeVectorStore.from_documents(
            documents=chunks,
            embedding=embeddings,
            index_name=index_name
        )
        print("Upsert complete!")
        return vector_store
    else:
        return PineconeVectorStore.from_existing_index(
            index_name=index_name,
            embedding=embeddings
        )

def clear_index():
    """
    Clears the entire Pinecone index to ensure a fresh start.
    """
    load_dotenv()
    api_key = os.getenv("PINECONE_API_KEY")
    pc = Pinecone(api_key=api_key)
    index_name = "repochat"
    
    existing_indexes = [index.name for index in pc.list_indexes()]
    if index_name in existing_indexes:
        print(f"Deleting index {index_name} to ensure freshness...")
        pc.delete_index(index_name)
        print("Index deleted.")


if __name__ == "__main__":
    # Test the connection 
    from ingestion import ingest_repo, clone_repository
    
    # 1. Get Data
    repo_url = "https://github.com/hwchase17/langchain" 
    path = clone_repository(repo_url)
    chunks = ingest_repo(path)
    
    # 2. Embed and Store (FULL INGESTION)
    print(f"Ingesting all {len(chunks)} chunks...")
    vector_store = get_vector_store(chunks)
    
    # 3. Verification Search
    print("\nTesting Retrieval...")
    results = vector_store.similarity_search("How do I split code?", k=1)
    print(f"Result: {results[0].page_content[:200]}")