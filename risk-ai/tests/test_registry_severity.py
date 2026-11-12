
import pandas as pd
import os

from modules.risk_engine import calculate_risk
from modules.registry_matcher import match_registry

test_registry_path = "data/test_registry_severity.csv"

test_data = [
    {
        "registry_id": "TEST001",
        "identifier_type": "email",
        "identifier_value": "highrisk@gmail.com",
        "reason": "High severity test",
        "severity": "HIGH",
        "status": "ACTIVE"
    },
    {
        "registry_id": "TEST002",
        "identifier_type": "email",
        "identifier_value": "mediumrisk@gmail.com",
        "reason": "Medium severity test",
        "severity": "MEDIUM",
        "status": "ACTIVE"
    },
    {
        "registry_id": "TEST003",
        "identifier_type": "email",
        "identifier_value": "lowrisk@gmail.com",
        "reason": "Low severity test",
        "severity": "LOW",
        "status": "ACTIVE"
    },
    {
        "registry_id": "TEST004",
        "identifier_type": "email",
        "identifier_value": "inactiverisk@gmail.com",
        "reason": "Inactive high severity test",
        "severity": "HIGH",
        "status": "INACTIVE"
    }
]

pd.DataFrame(test_data).to_csv(test_registry_path, index=False)

test_emails = [
    ("HIGH", "highrisk@gmail.com", 30),
    ("MEDIUM", "mediumrisk@gmail.com", 20),
    ("LOW", "lowrisk@gmail.com", 10),
    ("INACTIVE HIGH", "inactiverisk@gmail.com", 0)
]

print("SHIELDARBITER - REGISTRY SEVERITY TEST")
print("=" * 55)

try:
    for label, email, expected_points in test_emails:

        transaction = {
            "transaction_id": "SEVERITY_TEST",
            "email": email,
            "device_id": "",
            "ip_address": "",
            "amount": 0,
            "previous_orders": 1,
            "failed_attempts": 0
        }

        matches = match_registry(
            transaction,
            registry_path=test_registry_path
        )

        actual_points = 0

        for match in matches:
            if match["match_type"] == "EXACT":
                actual_points += {
                    "HIGH": 30,
                    "MEDIUM": 20,
                    "LOW": 10
                }.get(match["severity"].upper(), 0)
            else:
                actual_points += 5

        status = "PASS" if actual_points == expected_points else "FAIL"

        print(f"\n{label}")
        print(f"Expected points: {expected_points}")
        print(f"Actual points:   {actual_points}")
        print(f"Result: {status}")

finally:
    if os.path.exists(test_registry_path):
        os.remove(test_registry_path)

print("\nRegistry severity test completed.")
