import { getActiveOrganization, verifyUser } from "@/lib/auth/dal";
import { getCpdLog } from "@/lib/lms/cpd-log";
import { createCpdLogPdf } from "@/lib/pdf/cpd-log";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url); const from = url.searchParams.get("from") ?? "Beginning"; const to = url.searchParams.get("to") ?? "Today";
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) return Response.json({ error: "Organization required" }, { status: 400 });
  const rows = await getCpdLog(await createClient(), organization.id, user.id, from === "Beginning" ? undefined : from, to === "Today" ? undefined : to);
  const pdf = createCpdLogPdf({ learnerName: user.displayName, organizationName: organization.name, from, to, rows });
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=cpd-log.pdf", "Cache-Control": "private, no-store" } });
}
