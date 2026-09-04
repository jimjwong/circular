import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";
import { acceptInvitation } from "@/app/actions/organizations";
import { verifyUser } from "@/lib/auth/dal";

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await verifyUser();
  const { token } = await params;
  const { error } = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[#f3f6f4] p-5"><div className="w-full max-w-md rounded-[26px] border border-[#e1e7e3] bg-white p-8 text-center shadow-[0_20px_60px_rgba(24,55,42,.08)]"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e8f4ee] text-[#246d50]"><MailCheck size={24}/></span><span className="mt-6 block text-[10px] font-bold uppercase tracking-[.16em] text-[#347457]">Organization invitation</span><h1 className="font-display mt-2 text-2xl font-bold">Join your team on Circular</h1><p className="mt-3 text-sm leading-6 text-[#75837b]">You are signed in as <b>{user.email}</b>. Invitations can only be accepted by the matching email address.</p>{error&&<p role="alert" className="mt-5 rounded-xl bg-[#fff1ed] px-3 py-2.5 text-xs text-[#a94f37]">{error}</p>}<form action={acceptInvitation} className="mt-6"><input type="hidden" name="token" value={token}/><button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#183f30] text-sm font-bold text-white">Accept invitation <ArrowRight size={15}/></button></form><Link href="/dashboard" className="mt-4 inline-block text-xs font-semibold text-[#347457] hover:underline">Return to dashboard</Link></div></main>;
}
