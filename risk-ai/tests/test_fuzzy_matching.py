
from rapidfuzz import fuzz

from modules.registry_matcher import match_registry

test_emails = [
    "rahulsharma@gmail.com",
    "rahulsharma1@gmail.com",
    "rahulsharma@gmial.com",
    "completelydifferent@yahoo.com"
]

print("SHIELDARBITER - FUZZY MATCHING VALIDATION")
print("=" * 60)

reference = "rahulsharma@gmail.com"

print("\nSimilarity comparison:")

for email in test_emails:

    score = fuzz.ratio(reference, email)

    print(f"\nReference: {reference}")
    print(f"Test email: {email}")
    print(f"Similarity: {score:.2f}%")

print("\nRegistry matcher validation:")
print("=" * 60)

for email in test_emails:

    transaction = {
        "transaction_id": "FUZZY_TEST",
        "email": email,
        "device_id": "",
        "ip_address": ""
    }

    matches = match_registry(transaction)

    print(f"\nTesting: {email}")

    if matches:
        for match in matches:
            print(
                f"{match['match_type']} | "
                f"{match['registry_id']} | "
                f"Similarity: {match.get('similarity', 'Exact')}"
            )
    else:
        print("No registry match found.")

print("\nFuzzy matching validation completed.")
