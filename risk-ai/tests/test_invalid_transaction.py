
from modules.data_normalizer import normalize_transaction
from modules.risk_engine import calculate_risk

test_cases = [
    {
        "name": "Missing email",
        "transaction": {
            "transaction_id": "INVALID001",
            "email": None,
            "device_id": "DEVICE201",
            "ip_address": "103.25.10.20",
            "amount": 1000,
            "previous_orders": 2,
            "failed_attempts": 0
        }
    },
    {
        "name": "Invalid IP address",
        "transaction": {
            "transaction_id": "INVALID002",
            "email": "testuser@gmail.com",
            "device_id": "DEVICE202",
            "ip_address": "999.999.999.999",
            "amount": 1500,
            "previous_orders": 1,
            "failed_attempts": 0
        }
    },
    {
        "name": "Empty identifiers",
        "transaction": {
            "transaction_id": "INVALID003",
            "email": "",
            "device_id": "",
            "ip_address": "",
            "amount": 500,
            "previous_orders": 3,
            "failed_attempts": 0
        }
    }
]

print("SHIELDARBITER - INVALID TRANSACTION TEST")
print("=" * 55)

for test in test_cases:
    print(f"\nTest: {test['name']}")

    try:
        normalized = normalize_transaction(test["transaction"])
        result = calculate_risk(test["transaction"])

        print("Normalization: SUCCESS")
        print(f"Risk score: {result['risk_score']}")
        print(f"Classification: {result['classification']}")
        print("Result: PASS")

    except Exception as error:
        print(f"Result: FAIL")
        print(f"Error: {error}")

print("\nInvalid transaction testing completed.")
