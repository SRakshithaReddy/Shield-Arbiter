"""Conservative rule-based pre-dispute complaint arbitration.

This module produces recommendations only. It never issues refunds or
replacements; all financial or fulfilment actions require human review.
"""


def _as_bool(value):
    """Normalize common JSON/Python representations of evidence availability."""
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {
        "true", "1", "yes", "y", "available", "provided"
    }


def evaluate_complaint(complaint):
    """Evaluate a complaint and return a cautious recommendation."""
    complaint = complaint or {}
    complaint_type = str(complaint.get("complaint_type", "")).strip().upper()
    delivery_status = str(complaint.get("delivery_status", "")).strip().upper()
    evidence_value = complaint.get("evidence_available")
    evidence_text = str(evidence_value or "").strip().lower()
    has_evidence = _as_bool(evidence_value)
    delay_value = complaint.get("delivery_delay_days")

    try:
        delay_days = float(delay_value) if delay_value not in (None, "") else None
    except (TypeError, ValueError):
        delay_days = None

    recommendation = "REQUEST_MORE_EVIDENCE"
    reason = "The complaint details are incomplete. Request supporting information before deciding on a resolution."

    if complaint_type == "DELAYED_DELIVERY":
        if delivery_status in {"IN_TRANSIT", "IN TRANSIT", "SHIPPED"}:
            recommendation = "WAIT_FOR_DELIVERY"
            reason = (
                "The shipment is still in transit. Check the carrier's latest tracking estimate "
                "and wait for delivery or a confirmed delivery exception before considering compensation."
            )
        elif delivery_status in {"DELAYED", "DELIVERED", "DELIVERY_DELAYED"}:
            if has_evidence:
                recommendation = "MANUAL_REVIEW"
                reason = (
                    "Delivery-related evidence has been reported. A human reviewer should compare the promised "
                    "delivery date with the carrier-confirmed delivery timestamp and apply the merchant's policy. "
                    "This recommendation does not authorize a refund."
                )
            else:
                recommendation = "REQUEST_MORE_EVIDENCE"
                reason = (
                    "The buyer reports a delivery delay, but no supporting delivery evidence was supplied. "
                    "Request the order confirmation or promised delivery window, carrier tracking history, "
                    "and the carrier-confirmed delivery timestamp. The merchant must then assess eligibility "
                    "under its compensation policy."
                )
        else:
            recommendation = "REQUEST_MORE_EVIDENCE"
            reason = (
                "The delivery status is missing or unrecognized. Request the current carrier tracking status, "
                "promised delivery date, and actual delivery date before assessing the complaint."
            )

        if delay_days is not None:
            if delay_days < 0:
                recommendation = "MANUAL_REVIEW"
                reason = (
                    "The supplied delivery delay is negative, which is inconsistent with a delay claim. "
                    "Verify the dates and complaint details manually before proceeding."
                )
            elif delay_days == 0 and delivery_status in {"DELAYED", "DELIVERED", "DELIVERY_DELAYED"}:
                reason += " The supplied delay is 0 days, so verify the reported dates."

    elif complaint_type == "ITEM_NOT_RECEIVED":
        if delivery_status in {"IN_TRANSIT", "IN TRANSIT", "SHIPPED"}:
            recommendation = "WAIT_FOR_DELIVERY"
            reason = "The tracking status indicates that the package is still in transit. Check the latest carrier estimate."
        elif delivery_status == "DELIVERED":
            recommendation = "MANUAL_REVIEW" if has_evidence else "REQUEST_MORE_EVIDENCE"
            reason = (
                "The shipment is marked as delivered. Review carrier proof of delivery and the delivery address "
                "before deciding whether a refund is appropriate."
                if has_evidence else
                "The shipment is marked as delivered, but no supporting evidence was supplied. Request carrier proof "
                "of delivery and confirm the delivery address before a human reviewer decides the case."
            )

    elif complaint_type == "DAMAGED_ITEM":
        if evidence_text == "damage_photo" or (has_evidence and evidence_text != "true"):
            recommendation = "MANUAL_REVIEW"
            reason = "Damage evidence is available. A human reviewer should inspect the item and evidence before deciding on replacement or compensation."
        else:
            recommendation = "REQUEST_MORE_EVIDENCE"
            reason = "Request clear photographs of the damaged item and packaging, then review them before deciding on a resolution."

    elif complaint_type == "WRONG_ITEM":
        if evidence_text == "product_photo" or has_evidence:
            recommendation = "MANUAL_REVIEW"
            reason = "A product image or other evidence is reported. Compare it with the order details before deciding whether a replacement is appropriate."
        else:
            recommendation = "REQUEST_MORE_EVIDENCE"
            reason = "Request a photograph of the received item and its packaging, then compare it with the order details."

    elif complaint_type == "ITEM_NOT_AS_DESCRIBED":
        if evidence_text == "product_photo" or has_evidence:
            recommendation = "MANUAL_REVIEW"
            reason = "Evidence is available for comparison with the product listing. A human reviewer should assess the discrepancy before considering compensation."
        else:
            recommendation = "REQUEST_MORE_EVIDENCE"
            reason = "Request photographs or other details showing the difference between the received item and the product listing."

    else:
        recommendation = "REQUEST_MORE_EVIDENCE"
        reason = "The complaint type is missing or not supported by the rule-based engine. Request details and route the case for human review."

    return {
        "complaint_id": complaint.get("complaint_id"),
        "transaction_id": complaint.get("transaction_id"),
        "complaint_type": complaint_type or None,
        "delivery_status": delivery_status or None,
        "delivery_delay_days": delay_days,
        "recommendation": recommendation,
        "reason": reason,
        "requires_human_review": True,
        "engine": "python-rule-based-arbitration",
    }
