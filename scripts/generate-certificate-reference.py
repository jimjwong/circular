from pathlib import Path
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

OUTPUT = Path(__file__).resolve().parents[1] / "output" / "pdf" / "circular-certificate-reference.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
width, height = landscape(A4)
c = canvas.Canvas(str(OUTPUT), pagesize=(width, height))

green = HexColor("#183f30")
accent = HexColor("#c99a4b")
muted = HexColor("#62746a")
c.setFillColor(green)
c.rect(0, 0, width, height, fill=1, stroke=0)
c.setFillColor(white)
c.roundRect(24, 24, width - 48, height - 48, 18, fill=1, stroke=0)
c.setStrokeColor(accent)
c.setLineWidth(2)
c.roundRect(38, 38, width - 76, height - 76, 12, fill=0, stroke=1)

c.setFillColor(green)
c.setFont("Helvetica-Bold", 13)
c.drawCentredString(width / 2, height - 82, "ASIA PROFESSIONAL SPEAKERS SINGAPORE")
c.setFillColor(accent)
c.setFont("Helvetica-Bold", 11)
c.drawCentredString(width / 2, height - 110, "CERTIFICATE OF COMPLETION")
c.setFillColor(muted)
c.setFont("Helvetica", 11)
c.drawCentredString(width / 2, height - 148, "This certifies that")
c.setFillColor(green)
c.setFont("Helvetica-Bold", 30)
c.drawCentredString(width / 2, height - 194, "Jamie Chen")
c.setStrokeColor(accent)
c.setLineWidth(1)
c.line(width / 2 - 150, height - 207, width / 2 + 150, height - 207)
c.setFillColor(muted)
c.setFont("Helvetica", 11)
c.drawCentredString(width / 2, height - 239, "has successfully completed")
c.setFillColor(green)
c.setFont("Helvetica-Bold", 22)
c.drawCentredString(width / 2, height - 276, "Professional Community Leadership")
c.setFont("Helvetica-Bold", 12)
c.drawCentredString(width / 2, height - 309, "6.0 verified CPD hours")

verification_url = "http://localhost:3001/verify/00000000-0000-4000-8000-000000000001"
widget = qr.QrCodeWidget(verification_url)
bounds = widget.getBounds()
size = 74
drawing = Drawing(size, size, transform=[size / (bounds[2] - bounds[0]), 0, 0, size / (bounds[3] - bounds[1]), 0, 0])
drawing.add(widget)
renderPDF.draw(drawing, c, width / 2 - size / 2, 88)
c.setFillColor(muted)
c.setFont("Helvetica", 8)
c.drawCentredString(width / 2, 70, "Scan or visit the verification URL to validate this credential")
c.setFont("Helvetica", 7)
c.drawCentredString(width / 2, 57, verification_url)

c.setFillColor(green)
c.setFont("Helvetica-Bold", 10)
c.drawString(66, 102, "Issued")
c.setFillColor(muted)
c.setFont("Helvetica", 9)
c.drawString(66, 85, "4 September 2026")
c.setFillColor(green)
c.setFont("Helvetica-Bold", 10)
c.drawRightString(width - 66, 102, "Verification ID")
c.setFillColor(muted)
c.setFont("Helvetica", 9)
c.drawRightString(width - 66, 85, "00000000-0000-4000-8000-000000000001")

c.showPage()
c.save()
print(OUTPUT)
