
import pandas as pd
from modules.data_normalizer import normalize_transaction

# Load synthetic transaction data
df = pd.read_csv("data/transactions.csv")

print("SHIELDARBITER - DATA NORMALISATION TEST")
print("=" * 50)

normalized_records = []

for _, transaction in df.iterrows():
    normalized = normalize_transaction(transaction.to_dict())

    normalized_records.append({
        "transaction_id": transaction["transaction_id"],
        **normalized
    })

# Display normalised records
for record in normalized_records:
    print(record)

print("\nTotal transactions processed:", len(normalized_records))
print("Normalisation completed successfully.")
