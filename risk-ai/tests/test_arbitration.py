
import pandas as pd

from modules.arbitration_engine import evaluate_complaint

complaints = pd.read_csv("data/complaints.csv")

print("SHIELDARBITER - PRE-DISPUTE ARBITRATION")
print("=" * 65)

for _, row in complaints.iterrows():

    result = evaluate_complaint(row.to_dict())

    print(f"\nComplaint: {result['complaint_id']}")
    print(f"Transaction: {result['transaction_id']}")
    print(f"Recommendation: {result['recommendation']}")
    print(f"Reason: {result['reason']}")
    print(
        "Human review required:",
        result["requires_human_review"]
    )

print("\nArbitration testing completed.")
