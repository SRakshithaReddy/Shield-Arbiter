
from pathlib import Path

from modules.evidence_integrity import (
    record_evidence,
    verify_evidence
)

evidence_path = Path(
    "data/evidence/synthetic_delivery_evidence.png"
)

print("SHIELDARBITER - EVIDENCE INTEGRITY TEST")
print("=" * 55)

# Record original evidence
record = record_evidence(evidence_path)

print("\nOriginal evidence recorded.")
print("SHA-256:", record["sha256"])
print("Timestamp:", record["recorded_at"])

# Verify unchanged evidence
result = verify_evidence(
    evidence_path,
    record["sha256"]
)

print("\nIntegrity verification:")
print("Status:", result["integrity_status"])

# Modify the evidence file
with open(evidence_path, "ab") as file:
    file.write(b"TEST MODIFICATION")

# Verify again
modified_result = verify_evidence(
    evidence_path,
    record["sha256"]
)

print("\nAfter modifying the evidence:")
print("Status:", modified_result["integrity_status"])

print("\nEvidence integrity test completed.")
