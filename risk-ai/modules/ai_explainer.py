
def generate_explanation(risk_result):
    """Generate a human-readable explanation from risk signals."""

    transaction_id = risk_result["transaction_id"]
    score = risk_result["risk_score"]
    classification = risk_result["classification"]
    decision = risk_result["recommended_decision"]
    signals = risk_result["signals"]

    if not signals:
        explanation = (
            "No configured risk indicators were detected "
            "in this transaction. This does not guarantee "
            "that the transaction is safe."
        )

    else:
        signal_descriptions = []

        for signal in signals:
            description = (
                f"{signal['signal']} "
                f"(contributed {signal['points']} points)"
            )
            signal_descriptions.append(description)

        explanation = (
            "The transaction received risk points because "
            + "; ".join(signal_descriptions)
            + "."
        )

    return {
        "transaction_id": transaction_id,
        "risk_score": score,
        "classification": classification,
        "recommended_decision": decision,
        "explanation": explanation
    }
