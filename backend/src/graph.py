import os
import ast
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()


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
    Walks all .py files in repo_path, parses with AST, and writes
    File / Class / Function nodes + CONTAINS relationships to Neo4j.
    """
    driver = get_driver()
    clear_graph(driver)

    with driver.session() as session:
        for root, _, files in os.walk(repo_path):
            for filename in files:
                if not filename.endswith(".py"):
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
                    tree = ast.parse(source)
                except Exception:
                    continue

                # Only iterate direct children of the module — avoids double-counting
                for node in ast.iter_child_nodes(tree):
                    if isinstance(node, ast.ClassDef):
                        class_id = f"class:{rel_path}:{node.name}"
                        session.run(
                            """
                            MERGE (c:Class {id: $id, name: $name, file: $file})
                            WITH c
                            MATCH (f:File {id: $file_id})
                            MERGE (f)-[:CONTAINS]->(c)
                            """,
                            id=class_id, name=node.name,
                            file=rel_path, file_id=file_id,
                        )
                        # Methods inside the class
                        for item in ast.iter_child_nodes(node):
                            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                                method_id = f"method:{rel_path}:{node.name}:{item.name}"
                                session.run(
                                    """
                                    MERGE (m:Function {id: $id, name: $name, file: $file, class_name: $class_name})
                                    WITH m
                                    MATCH (c:Class {id: $class_id})
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
                            WITH fn
                            MATCH (f:File {id: $file_id})
                            MERGE (f)-[:CONTAINS]->(fn)
                            """,
                            id=fn_id, name=node.name,
                            file=rel_path, file_id=file_id,
                        )

    driver.close()


def get_graph_data() -> dict:
    """Returns all nodes and edges for frontend visualization."""
    driver = get_driver()

    with driver.session() as session:
        nodes_result = session.run(
            "MATCH (n) RETURN n.id AS id, labels(n)[0] AS label, properties(n) AS props"
        )
        nodes = [
            {"id": r["id"], "label": r["label"], "data": dict(r["props"])}
            for r in nodes_result
        ]

        edges_result = session.run(
            "MATCH (a)-[r]->(b) RETURN a.id AS source, b.id AS target, type(r) AS type"
        )
        edges = [
            {"source": r["source"], "target": r["target"], "type": r["type"]}
            for r in edges_result
        ]

    driver.close()
    return {"nodes": nodes, "edges": edges}
