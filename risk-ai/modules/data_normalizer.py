
import re
import ipaddress


def normalize_email(email):
    if not email or not isinstance(email, str):
        return None

    email = email.strip().lower()

    if email.count("@") != 1:
        return None

    local, domain = email.rsplit("@", 1)

    if not local or not domain:
        return None

    if (
        len(email) > 254
        or len(local) > 64
        or "." not in domain
        or domain.startswith(".")
        or domain.endswith(".")
    ):
        return None

    if domain in ("gmail.com", "googlemail.com"):
        local = local.split("+", 1)[0]
        local = local.replace(".", "")

        if not local:
            return None

        if domain == "googlemail.com":
            domain = "gmail.com"

    return f"{local}@{domain}"


def normalize_ip(ip):
    if not ip or not isinstance(ip, str):
        return None

    try:
        return str(ipaddress.ip_address(ip.strip()))
    except ValueError:
        return None


def normalize_device_id(device_id):
    if not device_id or not isinstance(device_id, str):
        return None

    normalized = re.sub(r"\s+", "", device_id).lower()

    return normalized if normalized else None


def normalize_address(address):
    if not address or not isinstance(address, str):
        return None

    normalized = " ".join(address.strip().lower().split())

    return normalized if normalized else None


def normalize_transaction(transaction):
    return {
        "email": normalize_email(transaction.get("email")),
        "ip_address": normalize_ip(transaction.get("ip_address")),
        "device_id": normalize_device_id(transaction.get("device_id")),
        "shipping_address": normalize_address(
            transaction.get("shipping_address")
        )
    }


def assess_data_quality(transaction):
    """Identify missing or invalid transaction identifiers."""

    normalized = normalize_transaction(transaction)
    warnings = []

    fields = {
        "email": "Email address",
        "ip_address": "IP address",
        "device_id": "Device identifier",
        "shipping_address": "Shipping address"
    }

    for field, label in fields.items():

        if not transaction.get(field):
            warnings.append(f"{label} is missing.")

        elif normalized[field] is None:
            warnings.append(f"{label} is invalid.")

    return {
        "data_quality": "INCOMPLETE" if warnings else "COMPLETE",
        "warnings": warnings,
        "normalized_data": normalized
    }
