
import pandas as pd
import os

from modules.registry_matcher import match_registry

test_registry_path = "data/test_identifier_severity.csv"

test_data = []

test_cases = [
    ("device_id", "device_high", "HIGH", 25),
    ("device_id", "device_medium", "MEDIUM", 15),
    ("device_id", "device_low", "LOW", 5),
    ("ip_address", "103.10.10.1", "HIGH", 10),
    ("ip_address", "103.10.10.2", "MEDIUM", 5),
    ("ip_address", "103.10.10.3", "LOW", 2),
]

for index, (identifier_type, value, severity, points) in enumerate(test_cases):
    test_data.append({
        "registry_id": f"TEST{index + 1:03}",
        "identifier_type": identifier_type,
        "identifier_value": value,
        "reason": "Identifier severity validation",
        "severity": severity,
        "status": "ACTIVE"
    })

# Add an inactive HIGH device record
test_data.append({
    "registry_id": "TEST007",
    "identifier_type": "device_id",
    "identifier_value": "device_inactive",
    "reason": "Inactive record test",
    "severity": "HIGH",
    "status": "INACTIVE"
})

pd.DataFrame(test_data).to_csv(test_registry_path, index=False)

print("SHIELDARBITER - IDENTIFIER SEVERITY TEST")
print("=" * 55)

try:
    for identifier_type, value, severity, expected_points in test_cases:

        transaction = {
            "transaction_id": "IDENTIFIER_TEST",
            "email": "",
            "device_id": "",
            "ip_address": ""
        }

        transaction[identifier_type] = value

        matches = match_registry(
            transaction,
            registry_path=test_registry_path
        )

        actual_points = 0

        for match in matches:
            if match["match_type"] == "EXACT":
                weights = {
                    "email": {"HIGH": 30, "MEDIUM": 20, "LOW": 10},
                    "device_id": {"HIGH": 25, "MEDIUM": 15, "LOW": 5},
                    "ip_address": {"HIGH": 10, "MEDIUM": 5, "LOW": 2}
                }

                actual_points += weights[identifier_type].get(
                    match["severity"].upper(), 0
                )

        status = "PASS" if actual_points == expected_points else "FAIL"

        print(f"\n{identifier_type.upper()} - {severity}")
        print(f"Expected: {expected_points}")
        print(f"Actual:   {actual_points}")
        print(f"Result:   {status}")

    inactive_transaction = {
        "transaction_id": "INACTIVE_TEST",
        "email": "",
        "device_id": "device_inactive",
        "ip_address": ""
    }

    inactive_matches = match_registry(
        inactive_transaction,
        registry_path=test_registry_path
    )

    inactive_status = "PASS" if not inactive_matches else "FAIL"

    print("\nINACTIVE HIGH DEVICE")
    print("Expected: 0")
    print(f"Actual:   {'0' if not inactive_matches else 'MATCH FOUND'}")
    print(f"Result:   {inactive_status}")

finally:
    if os.path.exists(test_registry_path):
        os.remove(test_registry_path)

print("\nIdentifier severity test completed.")
