
import pandas as pd

from modules.risk_engine import calculate_risk

transactions = pd.read_csv("data/transactions.csv")

print("SHIELDARBITER - RISK ENGINE TEST")
print("=" * 60)

for _, row in transactions.iterrows():

    result = calculate_risk(row.to_dict())

    print(f"\nTransaction: {result['transaction_id']}")
    print(f"Risk Score: {result['risk_score']}/100")
    print(f"Classification: {result['classification']}")
    print(f"Recommended Decision: {result['recommended_decision']}")

    print("Risk Signals:")

    if result["signals"]:
        for signal in result["signals"]:
            print(
                f"  - {signal['signal']} "
                f"(+{signal['points']})"
            )
    else:
        print("  No risk signals detected.")

print("\nRisk engine testing completed.")
