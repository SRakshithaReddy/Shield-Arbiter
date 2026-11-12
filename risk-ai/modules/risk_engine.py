
from modules.registry_matcher import match_registry


def calculate_risk(transaction):
    """Calculate an explainable transaction risk score."""

    score = 0
    signals = []

    amount = float(transaction.get("amount", 0))
    previous_orders = int(transaction.get("previous_orders", 0))
    failed_attempts = int(transaction.get("failed_attempts", 0))

    # Transaction amount
    if amount >= 7000:
        score += 20
        signals.append({
            "signal": "High transaction amount",
            "points": 20
        })
    elif amount >= 4000:
        score += 10
        signals.append({
            "signal": "Elevated transaction amount",
            "points": 10
        })

    # Customer history
    if previous_orders == 0:
        score += 10
        signals.append({
            "signal": "No previous orders",
            "points": 10
        })

    # Failed payment attempts
    if failed_attempts >= 5:
        score += 20
        signals.append({
            "signal": "Multiple failed payment attempts",
            "points": 20
        })
    elif failed_attempts >= 2:
        score += 10
        signals.append({
            "signal": "Repeated failed payment attempts",
            "points": 10
        })

    # Country mismatch: only compare valid two-letter country codes.
    ip_country = str(transaction.get("ip_country") or "").strip().upper()
    ship_country = str(transaction.get("ship_country") or "").strip().upper()

    valid_country_codes = (
        len(ip_country) == 2 and ip_country.isalpha()
        and len(ship_country) == 2 and ship_country.isalpha()
    )

    if valid_country_codes and ip_country != ship_country:
        score += 10
        signals.append({
            "signal": "IP country differs from shipping country",
            "points": 10
        })

    # Registry matching
    registry_matches = match_registry(transaction)

    for match in registry_matches:
        if match["match_type"] == "EXACT":
            points = {
                "email": {"HIGH": 30, "MEDIUM": 20, "LOW": 10},
                "device_id": {"HIGH": 25, "MEDIUM": 15, "LOW": 5},
                "ip_address": {"HIGH": 10, "MEDIUM": 5, "LOW": 2}
            }.get(match["identifier_type"], {}).get(
                str(match["severity"]).upper(), 0
            )
        else:
            points = 5

        score += points

        signals.append({
            "signal": (
                f"{match['match_type']} registry match: "
                f"{match['identifier_type']}"
            ),
            "points": points,
            "registry_id": match["registry_id"],
            "identifier_type": match["identifier_type"],
            "match_type": match["match_type"]
        })

    # Do not cap here. The Node adapter combines both registries
    # and applies the final 100-point cap after deduplication.
    if score >= 60:
        classification = "HIGH"
        decision = "HOLD"
    elif score >= 30:
        classification = "MEDIUM"
        decision = "VERIFY"
    else:
        classification = "LOW"
        decision = "APPROVE"

    return {
        "transaction_id": transaction.get("transaction_id"),
        "risk_score": score,
        "classification": classification,
        "recommended_decision": decision,
        "signals": signals,
        "registry_matches": registry_matches
    }
