import { getActiveOrganization, verifyUser } from "@/lib/auth/dal";
import { getCpdLog } from "@/lib/lms/cpd-log";
import { createClient } from "@/lib/supabase/server";

const csvCell = (value: string | number) => { let text = String(value); if (/^[=+\-@]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
export async function GET(request: Request) {
  const url = new URL(request.url); const from = url.searchParams.get("from") ?? undefined; const to = url.searchParams.get("to") ?? undefined;
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) return Response.json({ error: "Organization required" }, { status: 400 });
  const rows = await getCpdLog(await createClient(), organization.id, user.id, from, to);
  const csv = [["Date", "Course", "Learning item", "Minutes"], ...rows.map((row) => [row.date, row.course, row.item, row.minutes.toFixed(2)])].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=cpd-log.csv", "Cache-Control": "private, no-store" } });
}
