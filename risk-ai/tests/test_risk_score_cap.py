
from unittest.mock import patch
from modules.risk_engine import calculate_risk

transaction = {
    "transaction_id": "CAP_TEST",
    "email": "rahulsharma@gmail.com",
    "device_id": "device105",
    "ip_address": "185.220.101.5",
    "amount": 9000,
    "previous_orders": 0,
    "failed_attempts": 7
}

print("SHIELDARBITER - RISK SCORE CAP TEST")
print("=" * 55)

result = calculate_risk(transaction)

print(f"\nTransaction: {result['transaction_id']}")
print(f"Risk score: {result['risk_score']}/100")
print(f"Classification: {result['classification']}")
print(f"Decision: {result['recommended_decision']}")

if result["risk_score"] == 100:
    print("\nPASS: Risk score is capped at 100.")
else:
    print("\nFAIL: Unexpected risk score.")

print("\nRisk score cap test completed.")
