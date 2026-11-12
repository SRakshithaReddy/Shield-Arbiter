
import pandas as pd

from modules.registry_matcher import match_registry

transactions = pd.read_csv("data/transactions.csv")

print("SHIELDARBITER - FLAGGED REGISTRY TEST")
print("=" * 55)

for _, row in transactions.iterrows():

    transaction = row.to_dict()
    matches = match_registry(transaction)

    print(f"\nTransaction: {transaction['transaction_id']}")

    if matches:
        for match in matches:
            print(
                f"  {match['match_type']} MATCH | "
                f"{match['identifier_type']} | "
                f"{match['registry_id']} | "
                f"Severity: {match['severity']}"
            )
    else:
        print("  No registry matches found.")

print("\nRegistry matching test completed.")
