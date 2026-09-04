type CpdLogRow = { date: string; course: string; item: string; minutes: number };
type CpdLogInput = { learnerName: string; organizationName: string; from: string; to: string; rows: CpdLogRow[] };

const clean = (value: string, max = 80) => value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)").slice(0, max);

export function createCpdLogPdf(input: CpdLogInput) {
  const rowsPerPage = 22;
  const pages = Array.from({ length: Math.max(1, Math.ceil(input.rows.length / rowsPerPage)) }, (_, index) => input.rows.slice(index * rowsPerPage, (index + 1) * rowsPerPage));
  const objects: string[] = [];
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds = pages.map((_, index) => 5 + index * 2);
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  pages.forEach((pageRows, pageIndex) => {
    const pageId = pageIds[pageIndex];
    const contentId = pageId + 1;
    const commands = [
      "0.094 0.247 0.188 rg 0 0 842 595 re f",
      "1 1 1 rg 24 24 794 547 re f",
      `BT /F2 20 Tf 0.094 0.247 0.188 rg 50 532 Td (Continuing Professional Development Log) Tj ET`,
      `BT /F1 9 Tf 0.38 0.45 0.41 rg 50 510 Td (${clean(input.learnerName)} - ${clean(input.organizationName)} - ${clean(input.from)} to ${clean(input.to)}) Tj ET`,
      "0.91 0.94 0.92 rg 48 468 746 26 re f",
      "BT /F2 8 Tf 0.20 0.31 0.25 rg 56 478 Td (DATE) Tj ET",
      "BT /F2 8 Tf 0.20 0.31 0.25 rg 150 478 Td (COURSE) Tj ET",
      "BT /F2 8 Tf 0.20 0.31 0.25 rg 400 478 Td (LEARNING ITEM) Tj ET",
      "BT /F2 8 Tf 0.20 0.31 0.25 rg 720 478 Td (MIN) Tj ET",
    ];
    pageRows.forEach((row, rowIndex) => {
      const y = 457 - rowIndex * 18;
      commands.push(`BT /F1 8 Tf 0.28 0.36 0.31 rg 56 ${y} Td (${clean(row.date, 14)}) Tj ET`);
      commands.push(`BT /F1 8 Tf 0.28 0.36 0.31 rg 150 ${y} Td (${clean(row.course, 38)}) Tj ET`);
      commands.push(`BT /F1 8 Tf 0.28 0.36 0.31 rg 400 ${y} Td (${clean(row.item, 46)}) Tj ET`);
      commands.push(`BT /F1 8 Tf 0.28 0.36 0.31 rg 728 ${y} Td (${row.minutes.toFixed(1)}) Tj ET`);
      commands.push(`0.91 0.93 0.92 RG .5 w 48 ${y - 5} m 794 ${y - 5} l S`);
    });
    const totalMinutes = input.rows.reduce((sum, row) => sum + row.minutes, 0);
    commands.push(`BT /F2 10 Tf 0.094 0.247 0.188 rg 50 48 Td (Verified total: ${(totalMinutes / 60).toFixed(2)} hours) Tj ET`);
    commands.push(`BT /F1 8 Tf 0.38 0.45 0.41 rg 737 48 Td (Page ${pageIndex + 1}/${pages.length}) Tj ET`);
    const content = commands.join("\n");
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId - 1] = `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
  });
  let pdf = "%PDF-1.4\n%Circular\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}
