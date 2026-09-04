import Link from "next/link";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { Award, CheckCircle2, Clock3, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function VerifyCertificatePage({ params }: { params: Promise<{ verificationId: string }> }) {
  const { verificationId } = await params;
  const requestHeaders = await headers();
  const clientAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0] ?? requestHeaders.get("x-real-ip") ?? "local";
  const identifierHash = createHash("sha256").update(`${clientAddress}:certificate`).digest("hex");
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("check_verification_rate_limit", { check_identifier_hash: identifierHash });
  if (!allowed) return <VerificationShell><State icon={ShieldAlert} title="Too many verification attempts" detail="Please wait one minute, then try again." tone="amber"/></VerificationShell>;
  const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(verificationId);
  const { data } = validUuid ? await supabase.rpc("verify_course_certificate", { check_verification_id: verificationId }) : { data: [] };
  const credential = data?.[0];
  if (!credential) return <VerificationShell><State icon={ShieldAlert} title="Credential not found" detail="Check the verification ID or ask the issuing organization for help." tone="amber"/></VerificationShell>;
  const status = credential.credential_status as "valid" | "expired" | "revoked";
  return <VerificationShell><section className="rounded-[26px] border border-[#dfe7e2] bg-white p-6 shadow-sm sm:p-9"><div className="flex items-start gap-4"><span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${status === "valid" ? "bg-[#e6f3ec] text-[#247150]" : status === "expired" ? "bg-[#fff2dc] text-[#a36a17]" : "bg-[#fde9e5] text-[#a74639]"}`}>{status === "valid" ? <ShieldCheck size={27}/> : status === "expired" ? <Clock3 size={27}/> : <XCircle size={27}/>}</span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#6c7d73]">Certificate status</p><h1 className="font-display mt-1 text-2xl font-bold capitalize">{status}</h1><p className="mt-2 text-sm text-[#6f7e76]">This credential record is issued by Asia Professional Speakers Singapore.</p></div></div><dl className="mt-8 grid gap-5 border-t border-[#e9eeeb] pt-7 sm:grid-cols-2"><Detail label="Recipient" value={credential.recipient_name}/><Detail label="Course" value={credential.course_title}/><Detail label="CPD hours" value={`${Number(credential.cpd_hours)} hours`}/><Detail label="Issued" value={new Intl.DateTimeFormat("en-SG", { dateStyle: "long" }).format(new Date(credential.issued_at))}/><Detail label="Expires" value={credential.expires_at ? new Intl.DateTimeFormat("en-SG", { dateStyle: "long" }).format(new Date(credential.expires_at)) : "No expiry"}/><Detail label="Verification ID" value={verificationId}/></dl></section></VerificationShell>;
}

function VerificationShell({ children }: { children: React.ReactNode }) { return <main className="grid min-h-screen place-items-center bg-[#f4f7f5] p-4 text-[#18251f]"><div className="w-full max-w-3xl"><header className="mb-5 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#183f30] text-white"><Award size={20}/></span><div><b className="font-display block">Credential verification</b><span className="text-xs text-[#718078]">Asia Professional Speakers Singapore</span></div><Link href="/" className="ml-auto text-xs font-bold text-[#397258]">Circular</Link></header>{children}</div></main>; }
function State({ icon: Icon, title, detail, tone }: { icon: typeof CheckCircle2; title: string; detail: string; tone: "amber" }) { return <section className="rounded-[26px] border border-[#e5e8df] bg-white p-10 text-center"><Icon className={`mx-auto ${tone === "amber" ? "text-[#a36a17]" : "text-[#247150]"}`} size={34}/><h1 className="font-display mt-4 text-xl font-bold">{title}</h1><p className="mt-2 text-sm text-[#718078]">{detail}</p></section>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8a968f]">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>; }
