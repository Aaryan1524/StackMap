# The Brain (LLM + Retrieval logic)
import sys
import os

# Allow running this script directly by adding the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import os
from dotenv import load_dotenv
from operator import itemgetter
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableParallel
from src.vector_store import get_vector_store

# Load environment variables
load_dotenv()

def format_docs(docs):
    """Convert Documents to a single string."""
    return "\n\n".join(doc.page_content for doc in docs)

def get_rag_chain():
    """
    Creates the RAG chain using LCEL (LangChain Expression Language).
    Replaces create_retrieval_chain to avoid dependency issues.
    """
    # 1. Setup Vector Store & Retriever
    vector_store = get_vector_store()
    retriever = vector_store.as_retriever(search_kwargs={"k": 20})

    # 2. Setup LLM
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    # 3. Define the Prompt
    template = """You are a Senior Software Engineer specializing in code analysis.
Use the following pieces of retrieved context to answer the question.

Rules:
1. If the answer is not in the context, say "I cannot find this in the codebase."
2. Quote the specific class or function names if applicable.
3. Keep the answer technical and concise.

Context:
{context}

Question:
{input}

Answer:
"""
    prompt = ChatPromptTemplate.from_template(template)

    # 4. Create the Chain
    # Step A: Retrieve docs and pass input
    retrieval_step = RunnableParallel(
        context=(itemgetter("input") | retriever),
        input=itemgetter("input")
    )

    # Step B: Generate Answer (formatting docs for the LLM)
    answer_step = (
        RunnablePassthrough.assign(context=(lambda x: format_docs(x["context"])))
        | prompt
        | llm
        | StrOutputParser()
    )

    # Final Chain: Combine retrieval with answer generation
    # Output: {'context': [Docs], 'input': '...', 'answer': '...'}
    rag_chain = retrieval_step.assign(answer=answer_step)
    
    return rag_chain

if __name__ == "__main__":
    # Test the full Brain
    print("Initializing RAG Chain...")
    try:
        chain = get_rag_chain()
        
        query = "How is the RecursiveCharacterTextSplitter implemented?"
        print(f"\nThinking about: '{query}'...")
        
        # Invoke chain
        response = chain.invoke({"input": query})
        
        print("\n--- AI RESPONSE ---")
        print(response["answer"])
        print("\n--- SOURCES USED ---")
        for doc in response["context"]:
            print(f"- {doc.metadata.get('source', 'Unknown')}")
            
    except Exception as e:
        print(f"\n❌ Error running RAG chain: {e}")