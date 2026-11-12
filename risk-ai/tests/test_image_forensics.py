
from pathlib import Path
from PIL import Image

from modules.image_forensics import analyze_image

# Create a synthetic evidence image
evidence_folder = Path("data/evidence")
evidence_folder.mkdir(parents=True, exist_ok=True)

image_path = evidence_folder / "synthetic_delivery_evidence.png"

image = Image.new(
    "RGB",
    (800, 600),
    color=(180, 200, 220)
)

image.save(image_path)

print("Synthetic evidence image created.")
print("=" * 55)

# Analyse the image
result = analyze_image(image_path)

print("IMAGE FORENSICS REPORT")
print("=" * 55)

for key, value in result.items():
    print(f"{key}: {value}")

print("\nImage analysis completed.")
