from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "circle_screenshots.pdf"
OUT = ROOT / "tmp" / "pdfs"
OUT.mkdir(parents=True, exist_ok=True)


with pdfplumber.open(SOURCE) as pdf:
    text = []
    for index, page in enumerate(pdf.pages, start=1):
        text.append(f"\n===== PAGE {index} =====\n{page.extract_text() or ''}")
    (OUT / "circle_screenshots.txt").write_text("\n".join(text), encoding="utf-8")
    print(f"pages={len(pdf.pages)}")


document = pdfium.PdfDocument(SOURCE)
thumbs = []
for index in range(len(document)):
    page = document[index]
    bitmap = page.render(scale=0.55)
    image = bitmap.to_pil().convert("RGB")
    image.thumbnail((340, 440), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (360, 480), "white")
    canvas.paste(image, ((360 - image.width) // 2, 28))
    ImageDraw.Draw(canvas).text((14, 8), f"Page {index + 1}", fill="black")
    thumbs.append(canvas)

for start in range(0, len(thumbs), 12):
    subset = thumbs[start : start + 12]
    sheet = Image.new("RGB", (360 * 4, 480 * 3), "#dddddd")
    for offset, thumb in enumerate(subset):
        sheet.paste(thumb, ((offset % 4) * 360, (offset // 4) * 480))
    sheet.save(OUT / f"contact-{start + 1:03d}-{start + len(subset):03d}.jpg", quality=88)

print(f"contact_sheets={(len(thumbs) + 11) // 12}")
