import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet, GraduationCap } from "lucide-react";
import { getActiveOrganization, verifyUser } from "@/lib/auth/dal";
import { getCpdLog } from "@/lib/lms/cpd-log";
import { createClient } from "@/lib/supabase/server";

export default async function CpdLogPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) redirect("/onboarding");
  const year = new Date().getFullYear();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? "") ? params.from! : `${year}-01-01`;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? "") ? params.to! : new Date().toISOString().slice(0, 10);
  const rows = await getCpdLog(await createClient(), organization.id, user.id, from, to);
  const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  const query = new URLSearchParams({ from, to }).toString();
  return <main className="min-h-screen bg-[#f5f7f5] p-4 text-[#18251f] sm:p-8"><div className="mx-auto max-w-6xl space-y-6"><header className="flex flex-wrap items-center gap-3"><Link href="/learning" className="grid size-10 place-items-center rounded-xl border border-[#dce5df] bg-white"><ArrowLeft size={16}/></Link><span className="grid size-10 place-items-center rounded-xl bg-[#183f30] text-white"><GraduationCap size={18}/></span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#397558]">Auditable learning record</p><h1 className="font-display text-xl font-bold">CPD log</h1></div><div className="ml-auto flex gap-2"><a href={`/api/cpd-log/csv?${query}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#dce5df] bg-white px-3 text-xs font-bold"><FileSpreadsheet size={14}/> CSV</a><a href={`/api/cpd-log/pdf?${query}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#183f30] px-3 text-xs font-bold text-white"><Download size={14}/> PDF</a></div></header>
    <section className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr]"><div className="rounded-[20px] border border-[#e0e7e2] bg-white p-5"><strong className="font-display text-2xl">{(totalMinutes / 60).toFixed(2)}h</strong><p className="mt-1 text-xs text-[#718078]">Verified hours in range</p></div><div className="rounded-[20px] border border-[#e0e7e2] bg-white p-5"><strong className="font-display text-2xl">{rows.length}</strong><p className="mt-1 text-xs text-[#718078]">Heartbeat ledger entries</p></div><form className="grid grid-cols-2 gap-2 rounded-[20px] border border-[#e0e7e2] bg-white p-4"><label className="text-[9px] font-bold uppercase text-[#718078]">From<input type="date" name="from" defaultValue={from} className="mt-1 h-9 w-full rounded-lg border border-[#dce5df] px-2 text-xs"/></label><label className="text-[9px] font-bold uppercase text-[#718078]">To<input type="date" name="to" defaultValue={to} className="mt-1 h-9 w-full rounded-lg border border-[#dce5df] px-2 text-xs"/></label><button className="col-span-2 h-8 rounded-lg bg-[#e8f2ec] text-xs font-bold text-[#246749]">Apply range</button></form></section>
    <section className="overflow-hidden rounded-[22px] border border-[#e0e7e2] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead className="bg-[#f7f9f7] text-[9px] uppercase tracking-wide text-[#718078]"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Course</th><th className="px-5 py-3">Learning item</th><th className="px-5 py-3 text-right">Minutes</th></tr></thead><tbody className="divide-y divide-[#edf1ee]">{rows.map((row, index) => <tr key={`${row.date}-${index}`}><td className="px-5 py-3 text-xs">{row.date}</td><td className="px-5 py-3 text-xs font-semibold">{row.course}</td><td className="px-5 py-3 text-xs text-[#66766d]">{row.item}</td><td className="px-5 py-3 text-right text-xs font-semibold">{row.minutes.toFixed(1)}</td></tr>)}{!rows.length && <tr><td colSpan={4} className="p-10 text-center text-sm text-[#718078]">No verified learning sessions in this date range.</td></tr>}</tbody></table></div></section>
  </div></main>;
}
