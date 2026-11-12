
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone


def calculate_hash(file_path):
    """Generate a SHA-256 hash for an evidence file."""

    sha256 = hashlib.sha256()

    with open(file_path, "rb") as file:
        for chunk in iter(lambda: file.read(4096), b""):
            sha256.update(chunk)

    return sha256.hexdigest()


def record_evidence(file_path):
    """Record the original hash and timestamp of evidence."""

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(path)

    record = {
        "filename": path.name,
        "sha256": calculate_hash(path),
        "recorded_at": datetime.now(timezone.utc).isoformat()
    }

    records_file = Path("output/evidence_records.json")
    records_file.parent.mkdir(parents=True, exist_ok=True)

    records = []

    if records_file.exists():
        with open(records_file, "r", encoding="utf-8") as file:
            records = json.load(file)

    records.append(record)

    with open(records_file, "w", encoding="utf-8") as file:
        json.dump(records, file, indent=4)

    return record


def verify_evidence(file_path, original_hash):
    """Compare current file hash with the recorded original hash."""

    current_hash = calculate_hash(file_path)

    return {
        "filename": Path(file_path).name,
        "original_hash": original_hash,
        "current_hash": current_hash,
        "integrity_status": (
            "VERIFIED"
            if current_hash == original_hash
            else "CHANGED"
        )
    }
