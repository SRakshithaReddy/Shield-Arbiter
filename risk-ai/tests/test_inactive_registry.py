
import pandas as pd
import os

from modules.registry_matcher import match_registry

test_registry_path = "data/test_registry_inactive.csv"

# Create a temporary registry containing one inactive record
test_data = [{
    "registry_id": "TEST001",
    "identifier_type": "email",
    "identifier_value": "rahulsharma@gmail.com",
    "reason": "Test inactive record",
    "severity": "HIGH",
    "status": "INACTIVE"
}]

pd.DataFrame(test_data).to_csv(test_registry_path, index=False)

transaction = {
    "transaction_id": "INACTIVE_TEST",
    "email": "rahulsharma@gmail.com",
    "device_id": "",
    "ip_address": ""
}

print("SHIELDARBITER - INACTIVE REGISTRY TEST")
print("=" * 55)

matches = match_registry(
    transaction,
    registry_path=test_registry_path
)

if not matches:
    print("PASS: Inactive registry record was ignored.")
else:
    print("FAIL: Inactive registry record triggered a match.")
    print(matches)

# Remove temporary test file
if os.path.exists(test_registry_path):
    os.remove(test_registry_path)

print("\nInactive registry test completed.")
