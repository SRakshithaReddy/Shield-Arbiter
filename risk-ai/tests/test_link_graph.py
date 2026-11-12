
from modules.link_graph import (
    build_transaction_graph,
    get_graph_summary
)

graph = build_transaction_graph()
summary = get_graph_summary(graph)

print("SHIELDARBITER - TRANSACTION LINK GRAPH")
print("=" * 55)

print("Total transaction nodes:", summary["total_nodes"])
print("Total graph edges:", summary["total_edges"])

print("\nConnected transaction groups:")

for group in summary["transaction_groups"]:
    print(" -> ".join(group))

print("\nGraph connections:")

for connection in summary["connections"]:
    print(connection)

print("\nLink graph generation completed.")
