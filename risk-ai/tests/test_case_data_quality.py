
from modules.case_evaluator import evaluate_case

transaction = {
    "transaction_id": "DATA_TEST_001",
    "email": None,
    "payment_id": "PAY_TEST",
    "device_id": "DEVICE_TEST",
    "ip_address": "999.999.999.999",
    "shipping_address": "12 MG Road Bangalore",
    "amount": 1500,
    "previous_orders": 2,
    "failed_attempts": 0
}

complaint = {
    "complaint_id": "CMP_TEST_001",
    "transaction_id": "DATA_TEST_001",
    "complaint_type": "ITEM_NOT_RECEIVED",
    "buyer_description": "Buyer reports item not received",
    "delivery_status": "IN_TRANSIT",
    "evidence_available": "tracking_record",
    "item_value": 1500
}

print("SHIELDARBITER - CASE DATA QUALITY TEST")
print("=" * 55)

report = evaluate_case(transaction, complaint)

quality = report["data_quality"]

print(f"\nTransaction: {report['transaction_id']}")
print(f"Data quality: {quality['status']}")

print("\nWarnings:")
for warning in quality["warnings"]:
    print(f"- {warning}")

print(f"\nRisk classification: {report['risk_assessment']['classification']}")
print(f"Arbitration: {report['arbitration']['recommendation']}")

if (
    quality["status"] == "INCOMPLETE"
    and len(quality["warnings"]) == 2
    and report["requires_human_review"] is True
):
    print("\nPASS: Incomplete data is correctly reported.")
else:
    print("\nFAIL: Check the case data quality output.")

print("\nCase data quality test completed.")
