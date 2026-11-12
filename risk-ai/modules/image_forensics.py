
import hashlib
from pathlib import Path
from PIL import Image, ExifTags


def calculate_file_hash(file_path):
    """Calculate SHA-256 hash of an evidence file."""

    sha256 = hashlib.sha256()

    with open(file_path, "rb") as file:
        for chunk in iter(lambda: file.read(4096), b""):
            sha256.update(chunk)

    return sha256.hexdigest()


def analyze_image(file_path):
    """Inspect basic image properties and available EXIF metadata."""

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"Evidence file not found: {path}")

    result = {
        "filename": path.name,
        "file_size_bytes": path.stat().st_size,
        "sha256": calculate_file_hash(path),
        "metadata": {},
        "observations": []
    }

    try:
        with Image.open(path) as image:

            result["format"] = image.format
            result["dimensions"] = image.size
            result["mode"] = image.mode

            exif_data = image.getexif()

            if exif_data:
                for tag_id, value in exif_data.items():
                    tag_name = ExifTags.TAGS.get(
                        tag_id, str(tag_id)
                    )

                    result["metadata"][tag_name] = str(value)

                result["observations"].append(
                    "EXIF metadata is present."
                )

            else:
                result["observations"].append(
                    "No EXIF metadata found. "
                    "This alone does not indicate manipulation."
                )

    except Exception as error:
        result["error"] = str(error)

    return result
