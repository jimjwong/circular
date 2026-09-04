import Link from "next/link";
import { ArrowLeft, Bell, CheckCheck } from "lucide-react";
import { markCommunityNotificationsRead } from "@/app/actions/community";
import { verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
  const user = await verifyUser();
  const supabase = await createClient();
  const { data: notifications, error } = await supabase.from("notifications").select("id, actor_id, kind, message, read_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  const actorIds = [...new Set((notifications ?? []).flatMap((notification) => notification.actor_id ? [notification.actor_id] : []))];
  const { data: profiles } = actorIds.length ? await supabase.from("profiles").select("id, display_name").in("id", actorIds) : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || "A member"]));
  const unread = (notifications ?? []).filter((notification) => !notification.read_at).length;

  return <main className="min-h-screen bg-[#f5f7f5] p-4 text-[#18251f] sm:p-8"><div className="mx-auto max-w-3xl"><header className="flex items-center gap-3"><Link href="/community" className="grid size-10 place-items-center rounded-xl border border-[#dce5df] bg-white"><ArrowLeft size={16}/></Link><span className="grid size-10 place-items-center rounded-xl bg-[#183f30] text-white"><Bell size={17}/></span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#397558]">Member inbox</p><h1 className="font-display text-xl font-bold">Notifications</h1></div>{unread > 0 && <form action={markCommunityNotificationsRead} className="ml-auto"><button className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#dce5df] bg-white px-4 text-xs font-semibold"><CheckCheck size={14}/> Mark all read</button></form>}</header><section className="mt-6 overflow-hidden rounded-[22px] border border-[#e0e7e2] bg-white"><div className="border-b border-[#e8edea] p-5"><b className="font-display">Recent activity</b><p className="mt-1 text-xs text-[#7b8981]">{unread} unread notifications</p></div><div className="divide-y divide-[#edf1ee]">{(notifications ?? []).map((notification) => <Link href="/community" key={notification.id} className={`flex gap-3 p-5 hover:bg-[#f8faf8] ${notification.read_at ? "opacity-65" : "bg-[#f2f8f4]"}`}><span className={`mt-1 size-2 shrink-0 rounded-full ${notification.read_at ? "bg-[#cbd5cf]" : "bg-[#2f8060]"}`}/><div><p className="text-sm"><b>{notification.actor_id ? names.get(notification.actor_id) ?? "A member" : "Circular"}</b> {notification.message}</p><p className="mt-1 text-[10px] text-[#87938c]">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.created_at))}</p></div></Link>)}{!(notifications ?? []).length && <div className="p-10 text-center"><Bell className="mx-auto text-[#789084]"/><h2 className="font-display mt-3 font-bold">You’re all caught up</h2><p className="mt-2 text-xs text-[#7b8981]">Replies and reactions will appear here.</p></div>}</div></section></div></main>;
}
