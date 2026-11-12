
import pandas as pd

from modules.risk_engine import calculate_risk
from modules.ai_explainer import generate_explanation

transactions = pd.read_csv("data/transactions.csv")

print("SHIELDARBITER - EXPLAINABLE RISK ANALYSIS")
print("=" * 65)

for _, row in transactions.iterrows():

    risk_result = calculate_risk(row.to_dict())

    explanation = generate_explanation(risk_result)

    print(f"\nTransaction: {explanation['transaction_id']}")
    print(f"Risk Score: {explanation['risk_score']}/100")
    print(f"Classification: {explanation['classification']}")
    print(f"Decision: {explanation['recommended_decision']}")
    print("Explanation:")
    print(explanation["explanation"])

print("\nExplanation generation completed.")
