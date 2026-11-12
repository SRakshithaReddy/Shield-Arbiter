
import networkx as nx

from modules.link_analyzer import analyze_links


def build_transaction_graph():
    """Build a graph preserving all shared identifiers."""

    links = analyze_links()
    graph = nx.MultiGraph()

    for link in links:

        transactions = link["matched_transactions"]

        for transaction_id in transactions:
            graph.add_node(transaction_id)

        for i in range(len(transactions)):
            for j in range(i + 1, len(transactions)):

                graph.add_edge(
                    transactions[i],
                    transactions[j],
                    identifier_type=link["identifier_type"],
                    shared_value=link["shared_value"]
                )

    return graph


def get_graph_summary(graph):

    groups = [
        sorted(list(component))
        for component in nx.connected_components(graph)
        if len(component) > 1
    ]

    connections = []

    for source, target, key, attributes in graph.edges(
        keys=True, data=True
    ):
        connections.append({
            "transaction_1": source,
            "transaction_2": target,
            "relationship_id": key,
            **attributes
        })

    return {
        "transaction_groups": groups,
        "total_nodes": graph.number_of_nodes(),
        "total_edges": graph.number_of_edges(),
        "connections": connections
    }
