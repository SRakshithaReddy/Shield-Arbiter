
from modules.data_normalizer import assess_data_quality

test_cases = [
    {
        "name": "Complete transaction",
        "transaction": {
            "email": "testuser@gmail.com",
            "ip_address": "103.25.10.20",
            "device_id": "DEVICE101",
            "shipping_address": "12 MG Road Bangalore"
        },
        "expected": "COMPLETE"
    },
    {
        "name": "Missing email",
        "transaction": {
            "email": None,
            "ip_address": "103.25.10.20",
            "device_id": "DEVICE101",
            "shipping_address": "12 MG Road Bangalore"
        },
        "expected": "INCOMPLETE"
    },
    {
        "name": "Invalid IP",
        "transaction": {
            "email": "testuser@gmail.com",
            "ip_address": "999.999.999.999",
            "device_id": "DEVICE101",
            "shipping_address": "12 MG Road Bangalore"
        },
        "expected": "INCOMPLETE"
    },
    {
        "name": "All identifiers missing",
        "transaction": {
            "email": "",
            "ip_address": "",
            "device_id": "",
            "shipping_address": ""
        },
        "expected": "INCOMPLETE"
    }
]

print("SHIELDARBITER - DATA QUALITY TEST")
print("=" * 55)

for test in test_cases:
    result = assess_data_quality(test["transaction"])

    passed = result["data_quality"] == test["expected"]

    print(f"\nTest: {test['name']}")
    print(f"Expected: {test['expected']}")
    print(f"Actual: {result['data_quality']}")
    print(f"Warnings: {result['warnings']}")
    print(f"Result: {'PASS' if passed else 'FAIL'}")

print("\nData quality testing completed.")
