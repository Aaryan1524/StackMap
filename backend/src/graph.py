import os
import ast
import re
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

# All extensions that get a File node
SUPPORTED_EXTS = {
    ".py", ".js", ".jsx", ".ts", ".tsx",
    ".go", ".java", ".rb", ".rs", ".cpp", ".cc", ".c", ".cs",
}

SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".nuxt", "coverage", ".mypy_cache",
}

# Regex patterns: (class_pattern, function_pattern) per language group
_JS_TS_CLASS = re.compile(r'^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)', re.M)
_JS_TS_FN    = re.compile(r'^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)', re.M)
_GO_FUNC     = re.compile(r'^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(', re.M)
_GO_TYPE     = re.compile(r'^type\s+(\w+)\s+struct', re.M)
_JAVA_CLASS  = re.compile(r'^\s*(?:public\s+|private\s+|protected\s+)?(?:abstract\s+)?(?:class|interface|enum)\s+(\w+)', re.M)
_JAVA_METHOD = re.compile(r'^\s*(?:public|private|protected|static|final|abstract|\s)+[\w<>\[\]]+\s+(\w+)\s*\(', re.M)
_RUST_FN     = re.compile(r'^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)', re.M)
_RUST_STRUCT = re.compile(r'^\s*(?:pub\s+)?struct\s+(\w+)', re.M)
_RUBY_CLASS  = re.compile(r'^\s*class\s+(\w+)', re.M)
_RUBY_DEF    = re.compile(r'^\s*def\s+(\w+)', re.M)


def _extract_symbols(source: str, ext: str):
    """Returns (classes, functions) lists for non-Python files."""
    ext = ext.lower()
    if ext in (".js", ".jsx", ".ts", ".tsx"):
        return _JS_TS_CLASS.findall(source), _JS_TS_FN.findall(source)
    if ext == ".go":
        return _GO_TYPE.findall(source), _GO_FUNC.findall(source)
    if ext == ".java":
        return _JAVA_CLASS.findall(source), _JAVA_METHOD.findall(source)
    if ext == ".rs":
        return _RUST_STRUCT.findall(source), _RUST_FN.findall(source)
    if ext == ".rb":
        return _RUBY_CLASS.findall(source), _RUBY_DEF.findall(source)
    return [], []


def get_driver():
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "password")
    return GraphDatabase.driver(uri, auth=(user, password))


def clear_graph(driver):
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")


def populate_graph(repo_path: str):
    """
    Walks all supported code files in repo_path and writes
    File / Class / Function nodes + CONTAINS relationships to Neo4j.
    Python files are parsed with AST; other languages use regex.
    """
    driver = get_driver()
    clear_graph(driver)

    with driver.session() as session:
        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

            for filename in files:
                ext = os.path.splitext(filename)[1].lower()
                if ext not in SUPPORTED_EXTS:
                    continue

                full_path = os.path.join(root, filename)
                rel_path = os.path.relpath(full_path, repo_path)
                file_id = f"file:{rel_path}"

                session.run(
                    "MERGE (f:File {id: $id, path: $path, name: $name})",
                    id=file_id, path=rel_path, name=filename,
                )

                try:
                    with open(full_path, "r", encoding="utf-8") as f:
                        source = f.read()
                except Exception:
                    continue

                if ext == ".py":
                    # Full AST parse for Python
                    try:
                        tree = ast.parse(source)
                    except Exception:
                        continue

                    for node in ast.iter_child_nodes(tree):
                        if isinstance(node, ast.ClassDef):
                            class_id = f"class:{rel_path}:{node.name}"
                            session.run(
                                """
                                MERGE (c:Class {id: $id, name: $name, file: $file})
                                WITH c MATCH (f:File {id: $file_id})
                                MERGE (f)-[:CONTAINS]->(c)
                                """,
                                id=class_id, name=node.name,
                                file=rel_path, file_id=file_id,
                            )
                            for item in ast.iter_child_nodes(node):
                                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                                    method_id = f"method:{rel_path}:{node.name}:{item.name}"
                                    session.run(
                                        """
                                        MERGE (m:Function {id: $id, name: $name, file: $file, class_name: $class_name})
                                        WITH m MATCH (c:Class {id: $class_id})
                                        MERGE (c)-[:CONTAINS]->(m)
                                        """,
                                        id=method_id, name=item.name, file=rel_path,
                                        class_name=node.name, class_id=class_id,
                                    )
                        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            fn_id = f"function:{rel_path}:{node.name}"
                            session.run(
                                """
                                MERGE (fn:Function {id: $id, name: $name, file: $file, class_name: ''})
                                WITH fn MATCH (f:File {id: $file_id})
                                MERGE (f)-[:CONTAINS]->(fn)
                                """,
                                id=fn_id, name=node.name,
                                file=rel_path, file_id=file_id,
                            )
                else:
                    # Regex-based extraction for all other languages
                    classes, functions = _extract_symbols(source, ext)
                    for cls_name in classes:
                        class_id = f"class:{rel_path}:{cls_name}"
                        session.run(
                            """
                            MERGE (c:Class {id: $id, name: $name, file: $file})
                            WITH c MATCH (f:File {id: $file_id})
                            MERGE (f)-[:CONTAINS]->(c)
                            """,
                            id=class_id, name=cls_name,
                            file=rel_path, file_id=file_id,
                        )
                    for fn_name in functions:
                        fn_id = f"function:{rel_path}:{fn_name}"
                        session.run(
                            """
                            MERGE (fn:Function {id: $id, name: $name, file: $file, class_name: ''})
                            WITH fn MATCH (f:File {id: $file_id})
                            MERGE (f)-[:CONTAINS]->(fn)
                            """,
                            id=fn_id, name=fn_name,
                            file=rel_path, file_id=file_id,
                        )

    driver.close()


def get_graph_data(limit: int = 2000) -> dict:
    """
    Returns up to `limit` nodes (most connected first) and only the
    edges that connect those nodes — safe for browser rendering.
    """
    driver = get_driver()

    with driver.session() as session:
        # Fetch top-N nodes ordered by degree so the most important
        # parts of the codebase are always visible
        nodes_result = session.run(
            """
            MATCH (n)
            OPTIONAL MATCH (n)-[r]-()
            WITH n, count(r) AS degree
            ORDER BY degree DESC
            LIMIT $limit
            RETURN n.id AS id, labels(n)[0] AS label, properties(n) AS props
            """,
            limit=limit,
        )
        nodes = [
            {"id": r["id"], "label": r["label"], "data": dict(r["props"])}
            for r in nodes_result
        ]

        # Only return edges where BOTH endpoints are in the visible set
        node_ids = [n["id"] for n in nodes]
        edges_result = session.run(
            """
            MATCH (a)-[r]->(b)
            WHERE a.id IN $ids AND b.id IN $ids
            RETURN a.id AS source, b.id AS target, type(r) AS type
            """,
            ids=node_ids,
        )
        edges = [
            {"source": r["source"], "target": r["target"], "type": r["type"]}
            for r in edges_result
        ]

    driver.close()
    return {"nodes": nodes, "edges": edges, "total_in_db": None}
