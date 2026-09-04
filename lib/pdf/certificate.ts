type CertificatePdfInput = {
  recipientName: string;
  courseTitle: string;
  cpdHours: number;
  issuedDate: string;
  verificationId: string;
  verificationUrl: string;
};

function safeText(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function centered(value: string, size: number) {
  return Math.max(56, 421 - safeText(value).length * size * 0.26);
}

export function createCertificatePdf(input: CertificatePdfInput) {
  const recipient = safeText(input.recipientName).slice(0, 70);
  const course = safeText(input.courseTitle).slice(0, 90);
  const verificationUrl = safeText(input.verificationUrl).slice(0, 130);
  const verificationId = safeText(input.verificationId);
  const issuedDate = safeText(input.issuedDate);
  const commands = [
    "0.094 0.247 0.188 rg 0 0 842 595 re f",
    "1 1 1 rg 24 24 794 547 re f",
    "0.79 0.60 0.29 RG 2 w 38 38 766 519 re S",
    `BT /F2 13 Tf 0.094 0.247 0.188 rg 259 510 Td (ASIA PROFESSIONAL SPEAKERS SINGAPORE) Tj ET`,
    `BT /F2 11 Tf 0.79 0.60 0.29 rg 331 482 Td (CERTIFICATE OF COMPLETION) Tj ET`,
    `BT /F1 11 Tf 0.38 0.45 0.41 rg 374 444 Td (This certifies that) Tj ET`,
    `BT /F2 30 Tf 0.094 0.247 0.188 rg ${centered(recipient, 30)} 395 Td (${recipient}) Tj ET`,
    "0.79 0.60 0.29 RG 1 w 271 382 m 571 382 l S",
    `BT /F1 11 Tf 0.38 0.45 0.41 rg 354 344 Td (has successfully completed) Tj ET`,
    `BT /F2 22 Tf 0.094 0.247 0.188 rg ${centered(course, 22)} 303 Td (${course}) Tj ET`,
    `BT /F2 12 Tf 0.094 0.247 0.188 rg ${centered(`${input.cpdHours.toFixed(1)} verified CPD hours`, 12)} 267 Td (${input.cpdHours.toFixed(1)} verified CPD hours) Tj ET`,
    `BT /F2 10 Tf 0.094 0.247 0.188 rg 66 108 Td (Issued) Tj ET`,
    `BT /F1 9 Tf 0.38 0.45 0.41 rg 66 91 Td (${issuedDate}) Tj ET`,
    `BT /F2 10 Tf 0.094 0.247 0.188 rg 688 108 Td (Verification ID) Tj ET`,
    `BT /F1 8 Tf 0.38 0.45 0.41 rg 637 91 Td (${verificationId}) Tj ET`,
    `BT /F1 8 Tf 0.38 0.45 0.41 rg ${centered(verificationUrl, 8)} 63 Td (${verificationUrl}) Tj ET`,
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n%Circular\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}
