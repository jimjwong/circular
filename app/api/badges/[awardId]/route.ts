import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { signBadgeAward } from "@/lib/badges/open-badge";

export async function GET(_request: Request, { params }: { params: Promise<{ awardId: string }> }) {
  const { awardId } = await params;
  const supabase = await createClient();
  const { data: award } = await supabase.from("course_badge_awards").select("id").eq("id", awardId).maybeSingle();
  if (!award) return Response.json({ error: "Badge award not found" }, { status: 404 });
  const assertion = await signBadgeAward(createAdminClient(), award.id);
  return new Response(assertion.compactJwt, { headers: { "Content-Type": "application/vc+jwt", "Content-Disposition": `attachment; filename="open-badge-${award.id}.jwt"`, "Cache-Control": "private, no-store" } });
}
