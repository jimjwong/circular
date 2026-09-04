import { createClient } from "@/lib/supabase/server";

const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
export async function GET(_request: Request, { params }: { params: Promise<{ verificationId: string }> }) {
  const { verificationId } = await params;
  const supabase = await createClient();
  const [{ data: credential }, { data: verified }] = await Promise.all([
    supabase.rpc("get_open_badge_credential", { check_verification_id: verificationId }),
    supabase.rpc("verify_course_badge", { check_verification_id: verificationId }),
  ]);
  const badge = verified?.[0];
  if (!credential || !badge) return Response.json({ error: "Badge not found" }, { status: 404 });
  const metadata = xml(JSON.stringify(credential));
  const name = xml(badge.badge_name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>${name}</title><metadata id="openbadges">${metadata}</metadata><circle cx="256" cy="256" r="238" fill="#183f30"/><circle cx="256" cy="256" r="206" fill="#f8f4ea" stroke="#c99a4b" stroke-width="12"/><path d="M256 112l37 76 84 12-61 59 15 84-75-40-75 40 15-84-61-59 84-12z" fill="#c99a4b"/><circle cx="256" cy="247" r="66" fill="#183f30"/><path d="M219 246l25 25 51-55" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="18"/><path d="M187 352l-25 111 94-48 94 48-25-111" fill="#286b50" stroke="#183f30" stroke-width="8"/></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="open-badge-${verificationId}.svg"`, "Cache-Control": "public, max-age=300" } });
}
