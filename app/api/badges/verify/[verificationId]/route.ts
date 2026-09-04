import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ verificationId: string }> }) {
  const { verificationId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(verificationId)) return Response.json({ error: "Invalid verification ID" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_open_badge_credential", { check_verification_id: verificationId });
  if (error || !data) return Response.json({ error: "Badge not found" }, { status: 404 });
  return Response.json(data, { headers: { "Content-Type": "application/ld+json", "Cache-Control": "public, max-age=300" } });
}
