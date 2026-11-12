
import pandas as pd

from modules.data_normalizer import normalize_transaction


def analyze_links(csv_path="data/transactions.csv"):
    """Identify transactions sharing normalised identifiers."""

    df = pd.read_csv(csv_path).fillna("")

    identifier_groups = {
        "email": {},
        "device_id": {},
        "ip_address": {}
    }

    # Group transactions by identifier
    for _, row in df.iterrows():

        transaction = row.to_dict()
        normalized = normalize_transaction(transaction)

        transaction_id = transaction["transaction_id"]

        for identifier_type in identifier_groups:

            value = normalized.get(identifier_type)

            if value:
                identifier_groups[identifier_type].setdefault(
                    value, []
                ).append(transaction_id)

    links = []

    # Identify shared identifiers
    for identifier_type, groups in identifier_groups.items():

        for value, transaction_ids in groups.items():

            if len(transaction_ids) > 1:

                links.append({
                    "identifier_type": identifier_type,
                    "matched_transactions": transaction_ids,
                    "transaction_count": len(transaction_ids),
                    "shared_value": value,
                    "observation": (
                        f"{len(transaction_ids)} transactions "
                        f"share the same {identifier_type}."
                    )
                })

    return links
