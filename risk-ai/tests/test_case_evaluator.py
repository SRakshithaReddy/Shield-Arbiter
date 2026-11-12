
import pandas as pd
import json

from modules.case_evaluator import evaluate_case

transactions = pd.read_csv("data/transactions.csv")
complaints = pd.read_csv("data/complaints.csv")

print("SHIELDARBITER - INTEGRATED CASE EVALUATION")
print("=" * 65)

for _, transaction_row in transactions.iterrows():

    transaction = transaction_row.to_dict()

    matching_complaints = complaints[
        complaints["transaction_id"] == transaction["transaction_id"]
    ]

    if matching_complaints.empty:
        continue

    complaint = matching_complaints.iloc[0].to_dict()

    report = evaluate_case(
        transaction,
        complaint
    )

    print(f"\nCase: {report['complaint_id']}")
    print(f"Transaction: {report['transaction_id']}")

    print(
        "Risk:",
        report["risk_assessment"]["risk_score"],
        "/100"
    )

    print(
        "Classification:",
        report["risk_assessment"]["classification"]
    )

    print(
        "Arbitration:",
        report["arbitration"]["recommendation"]
    )

    print(
        "Registry matches:",
        len(report["registry_matches"])
    )

    print("Human review:", report["requires_human_review"])

    # Save consolidated report
    output_path = (
        f"output/{report['complaint_id']}_case_report.json"
    )

    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(report, file, indent=4)

print("\nAll integrated cases evaluated.")
print("Reports saved in the output folder.")
