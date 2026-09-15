import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, Mail, Send, Users, XCircle } from "lucide-react";
import { sendSavedBroadcast } from "@/app/actions/email";
import { CampaignComposer } from "@/components/email/campaign-composer";
import { requireOrganizationPermission } from "@/lib/auth/dal";
import { checkListmonk } from "@/lib/email/listmonk";
import { createClient } from "@/lib/supabase/server";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not sent";
}

export default async function EmailPage() {
  const organization = await requireOrganizationPermission("communications.manage");
  if (!organization) redirect("/onboarding");
  const supabase = await createClient();
  const [{ data: broadcasts, error }, { data: roles }, { data: segments }] = await Promise.all([
    supabase.from("email_broadcasts").select("id, subject, preview_text, status, recipient_count, listmonk_status, error_message, sent_at, created_at").eq("tenant_id", organization.id).order("created_at", { ascending: false }),
    supabase.from("tenant_access_roles").select("slug, name").eq("tenant_id", organization.id).order("name"),
    supabase.from("member_segments").select("id, name").eq("tenant_id", organization.id).order("name"),
  ]);
  if (error) throw new Error(`Unable to load broadcasts: ${error.message}`);
  const serviceOnline = await checkListmonk().catch(() => false);
  const sentCount = (broadcasts ?? []).filter((item) => item.status === "published").length;
  const totalRecipients = (broadcasts ?? []).reduce((sum, item) => sum + item.recipient_count, 0);

  return <main className="min-h-screen bg-[#f5f7f5] p-4 text-[#18251f] sm:p-7">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/dashboard" aria-label="Back to dashboard" className="grid size-10 place-items-center rounded-xl border border-[#dce5df] bg-white"><ArrowLeft size={16}/></Link>
        <span className="grid size-10 place-items-center rounded-xl bg-[#183f30] text-white"><Mail size={18}/></span>
        <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#397558]">Audience communication</p><h1 className="font-display text-xl font-bold">Email Hub</h1></div>
        <span className={`ml-auto inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${serviceOnline ? "bg-[#e6f3eb] text-[#246b4d]" : "bg-[#fff0e8] text-[#974e2f]"}`}>{serviceOnline ? <CheckCircle2 size={14}/> : <XCircle size={14}/>} {serviceOnline ? "Local email service online" : "Email service offline"}</span>
        <a href="/email/listmonk" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#dce5df] bg-white px-4 text-xs font-bold">Open listmonk <ExternalLink size={13}/></a>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {[{ label: "Broadcasts", value: String(broadcasts?.length ?? 0), icon: Mail }, { label: "Campaign sends", value: String(sentCount), icon: Send }, { label: "Snapshotted recipients", value: String(totalRecipients), icon: Users }].map(({ label, value, icon: Icon }) => <article key={label} className="rounded-[20px] border border-[#e0e7e2] bg-white p-5"><div className="flex items-start justify-between"><span className="text-sm text-[#718078]">{label}</span><span className="grid size-9 place-items-center rounded-xl bg-[#edf4f0] text-[#2c7154]"><Icon size={16}/></span></div><strong className="font-display mt-5 block text-3xl">{value}</strong></article>)}
      </section>

      <div className="mt-5"><CampaignComposer communityName={organization.name} roles={roles ?? []} segments={segments ?? []}/></div>

      <section className="mt-5 overflow-hidden rounded-[22px] border border-[#dfe7e1] bg-white">
        <div className="border-b border-[#e8ece9] p-5 sm:p-6"><h2 className="font-display font-bold">Broadcast history</h2><p className="mt-1 text-xs text-[#7b8981]">Audience membership is snapshotted when a draft is created so every send is auditable.</p></div>
        <div className="divide-y divide-[#edf0ee]">
          {(broadcasts ?? []).map((broadcast) => <article key={broadcast.id} className="flex flex-wrap items-center gap-4 p-5">
            <span className={`grid size-10 place-items-center rounded-xl ${broadcast.error_message ? "bg-[#fff0e8] text-[#985133]" : broadcast.status === "published" ? "bg-[#e8f3ed] text-[#276e50]" : "bg-[#f0f2f1] text-[#69776f]"}`}>{broadcast.error_message ? <XCircle size={17}/> : broadcast.status === "published" ? <CheckCircle2 size={17}/> : <Clock3 size={17}/>}</span>
            <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold">{broadcast.subject}</h3><p className="mt-1 text-xs text-[#7a8880]">{broadcast.recipient_count} recipients · {broadcast.status === "published" ? formatDate(broadcast.sent_at) : `Drafted ${formatDate(broadcast.created_at)}`}</p>{broadcast.error_message && <p className="mt-1 text-xs font-semibold text-[#9a4f31]">{broadcast.error_message}</p>}</div>
            <span className="rounded-full bg-[#f1f4f2] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#5f6f66]">{broadcast.listmonk_status || broadcast.status}</span>
            {broadcast.status === "draft" && <form action={sendSavedBroadcast}><input type="hidden" name="broadcastId" value={broadcast.id}/><button disabled={!serviceOnline} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#183f30] px-4 text-xs font-bold text-white disabled:opacity-40"><Send size={13}/> Send now</button></form>}
          </article>)}
          {!broadcasts?.length && <div className="p-12 text-center"><Mail className="mx-auto text-[#5c826f]"/><h3 className="font-display mt-4 font-bold">No broadcasts yet</h3><p className="mt-2 text-sm text-[#7d8a82]">Create a draft above, choose the audience, and queue the first local campaign.</p></div>}
        </div>
      </section>
    </div>
  </main>;
}
