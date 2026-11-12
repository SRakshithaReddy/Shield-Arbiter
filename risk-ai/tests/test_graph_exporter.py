
import json

from modules.graph_exporter import export_graph

result = export_graph()

print("SHIELDARBITER - GRAPH JSON EXPORT")
print("=" * 50)

print("Total nodes:", result["summary"]["total_nodes"])
print("Total edges:", result["summary"]["total_edges"])

print("\nConnected groups:")

for group in result["summary"]["connected_groups"]:
    print(group)

print("\nExport completed successfully.")
print("File: output/transaction_graph.json")
