
from modules.risk_engine import calculate_risk
from modules.arbitration_engine import evaluate_complaint
from modules.evidence_integrity import verify_evidence
from modules.data_normalizer import assess_data_quality


def evaluate_case(transaction, complaint, evidence_path=None,
                  original_hash=None):

    # Evaluate transaction risk
    risk_result = calculate_risk(transaction)

    # Evaluate transaction data quality
    data_quality_result = assess_data_quality(transaction)

    # Evaluate buyer complaint
    arbitration_result = evaluate_complaint(complaint)

    # Check evidence integrity
    evidence_result = None

    if evidence_path and original_hash:
        evidence_result = verify_evidence(
            evidence_path,
            original_hash
        )

    # Combine case information
    case_report = {
        "complaint_id": complaint.get("complaint_id"),
        "transaction_id": transaction.get("transaction_id"),

        "risk_assessment": {
            "risk_score": risk_result["risk_score"],
            "classification": risk_result["classification"],
            "decision": risk_result["recommended_decision"],
            "signals": risk_result["signals"]
        },

        "data_quality": {
            "status": data_quality_result["data_quality"],
            "warnings": data_quality_result["warnings"]
        },

        "registry_matches": risk_result["registry_matches"],
        "arbitration": arbitration_result,
        "evidence_integrity": evidence_result,
        "requires_human_review": True
    }

    # Warn if evidence has changed
    if evidence_result and evidence_result["integrity_status"] != "VERIFIED":
        case_report["evidence_warning"] = (
            "Evidence file differs from its recorded original hash. "
            "Preserve both versions and investigate before relying on it."
        )

    return case_report
