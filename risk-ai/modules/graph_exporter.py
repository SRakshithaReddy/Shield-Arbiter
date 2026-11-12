
import json
from pathlib import Path

from modules.link_graph import (
    build_transaction_graph,
    get_graph_summary
)


def export_graph(output_path="output/transaction_graph.json"):

    graph = build_transaction_graph()
    summary = get_graph_summary(graph)

    # Create dashboard-friendly node data
    nodes = [
        {"id": transaction_id}
        for transaction_id in graph.nodes()
    ]

    # Preserve every relationship
    edges = [
        {
            "source": connection["transaction_1"],
            "target": connection["transaction_2"],
            "identifier_type": connection["identifier_type"],
            "shared_value": connection["shared_value"]
        }
        for connection in summary["connections"]
    ]

    graph_data = {
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "connected_groups": summary["transaction_groups"]
        }
    }

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8") as file:
        json.dump(graph_data, file, indent=4)

    return graph_data
