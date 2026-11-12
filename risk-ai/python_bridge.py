
"""JSON stdin/stdout bridge for ShieldArbiter."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from modules.risk_engine import calculate_risk
from modules.data_normalizer import assess_data_quality
from modules.ai_explainer import generate_explanation
from modules.arbitration_engine import evaluate_complaint
from modules.image_forensics import analyze_image


def main():
    payload = json.loads(sys.stdin.read() or "{}")
    operation = payload.get("operation", "risk")

    if operation == "risk":
        transaction = {
            "transaction_id": payload.get("transaction_id"),
            "email": payload.get("email"),
            "ip_address": payload.get("ip") or payload.get("ip_address"),
            "ip_country": payload.get("ip_country"),
            "ship_country": payload.get("ship_country"),
            "device_id": payload.get("device_id"),
            "shipping_address": payload.get("shipping_address"),
            "amount": payload.get("amount", 0),
            "previous_orders": payload.get("previous_orders", 0),
            "failed_attempts": payload.get("failed_attempts", 0),
        }

        risk = calculate_risk(transaction)
        quality = assess_data_quality(transaction)
        explanation = generate_explanation(risk)

        print(json.dumps({
            "risk": risk,
            "data_quality": quality,
            "explanation": explanation
        }, default=str))

    elif operation == "arbitration":
        complaint = payload.get("complaint", {})
        result = evaluate_complaint(complaint)
        print(json.dumps(result, default=str))

    elif operation == "image_forensics":
        file_path = payload.get("file_path")
        if not file_path:
            raise ValueError("file_path is required")

        result = analyze_image(file_path)
        print(json.dumps(result, default=str))

    else:
        raise ValueError(f"Unsupported operation: {operation}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
