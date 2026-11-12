
from modules.link_analyzer import analyze_links

print("SHIELDARBITER - LINKED IDENTIFIER ANALYSIS")
print("=" * 60)

links = analyze_links()

if not links:
    print("No shared identifiers found.")

else:
    for link in links:

        print("\nIdentifier:", link["identifier_type"])
        print("Shared value:", link["shared_value"])

        print(
            "Transactions:",
            ", ".join(link["matched_transactions"])
        )

        print(
            "Transaction count:",
            link["transaction_count"]
        )

        print("Observation:", link["observation"])

print("\nLinked identifier analysis completed.")
