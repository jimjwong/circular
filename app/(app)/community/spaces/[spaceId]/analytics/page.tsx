import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, Heart, MessageCircle, MessagesSquare, Settings, TrendingUp, Users } from "lucide-react";
import { requireOrganizationRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

function dayKey(value: string) {
  return value.slice(0, 10);
}

export default async function SpaceAnalyticsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const supabase = await createClient();
  const { data: space } = await supabase.from("spaces").select("id, name, slug, status").eq("id", spaceId).eq("tenant_id", organization.id).maybeSingle();
  if (!space) notFound();

  const [{ data: posts }, { data: memberRows }] = await Promise.all([
    supabase.from("posts").select("id, author_id, published_at, created_at").eq("space_id", space.id).eq("tenant_id", organization.id).eq("status", "published"),
    supabase.from("space_members").select("user_id, created_at").eq("space_id", space.id).eq("tenant_id", organization.id),
  ]);
  const postIds = (posts ?? []).map((post) => post.id);
  const [{ data: comments }, { data: reactions }] = postIds.length ? await Promise.all([
    supabase.from("comments").select("id, author_id, created_at").in("post_id", postIds).eq("tenant_id", organization.id),
    supabase.from("reactions").select("id, user_id, created_at").in("post_id", postIds).eq("tenant_id", organization.id),
  ]) : [{ data: [] }, { data: [] }];

  const contributorIds = [...new Set([...(posts ?? []).map((post) => post.author_id), ...(comments ?? []).map((comment) => comment.author_id)])];
  const { data: profiles } = contributorIds.length ? await supabase.from("profiles").select("id, display_name").in("id", contributorIds) : { data: [] };
  const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || "Member"]));
  const contributionCounts = new Map<string, number>();
  for (const post of posts ?? []) contributionCounts.set(post.author_id, (contributionCounts.get(post.author_id) ?? 0) + 1);
  for (const comment of comments ?? []) contributionCounts.set(comment.author_id, (contributionCounts.get(comment.author_id) ?? 0) + 1);
  const topContributors = [...contributionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (13 - index));
    return date.toISOString().slice(0, 10);
  });
  const activity = new Map(days.map((day) => [day, 0]));
  for (const item of [...(posts ?? []), ...(comments ?? []), ...(reactions ?? [])]) {
    const key = dayKey("published_at" in item && item.published_at ? item.published_at : item.created_at);
    if (activity.has(key)) activity.set(key, (activity.get(key) ?? 0) + 1);
  }
  const maximum = Math.max(1, ...activity.values());
  const metrics = [
    ["Published posts", posts?.length ?? 0, MessagesSquare],
    ["Comments", comments?.length ?? 0, MessageCircle],
    ["Reactions", reactions?.length ?? 0, Heart],
    ["Contributors", contributorIds.length, Users],
  ] as const;

  return <main className="min-h-screen bg-[#f5f7f5] p-4 text-[#18251f] sm:p-8">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center gap-3"><Link href={`/community/spaces/${space.id}`} aria-label="Back to settings" className="grid size-10 place-items-center rounded-xl border border-[#dce5df] bg-white text-[#607168]"><ArrowLeft size={16}/></Link><span className="grid size-10 place-items-center rounded-xl bg-[#183f30] text-white"><BarChart3 size={17}/></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#397558]">Space analytics</p><h1 className="font-display truncate text-xl font-bold">{space.name}</h1></div><Link href={`/community/spaces/${space.id}`} className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl border border-[#dce5df] bg-white px-3 text-xs font-semibold text-[#52675b]"><Settings size={14}/> Settings</Link></header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([label, value, Icon]) => <div key={label} className="rounded-[20px] border border-[#e0e7e2] bg-white p-5"><div className="flex items-center justify-between"><span className="text-xs text-[#74827a]">{label}</span><Icon size={16} className="text-[#317657]"/></div><b className="font-display mt-3 block text-2xl">{value.toLocaleString()}</b></div>)}</section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[22px] border border-[#e0e7e2] bg-white p-5 sm:p-7"><div className="flex items-center gap-2"><TrendingUp size={17} className="text-[#317657]"/><div><h2 className="font-display font-bold">14-day activity</h2><p className="mt-1 text-xs text-[#7b8981]">Posts, comments, and reactions by day.</p></div></div><div className="mt-8 flex h-48 items-end gap-2">{days.map((day) => { const value = activity.get(day) ?? 0; return <div key={day} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-[9px] font-semibold text-[#607168]">{value}</span><div className="w-full rounded-t-lg bg-[#2f7658]" style={{ height: `${Math.max(value ? 12 : 3, (value / maximum) * 140)}px`, opacity: value ? 1 : .16 }}/><span className="hidden text-[8px] text-[#89968f] sm:block">{day.slice(5)}</span></div>; })}</div></section>
        <aside className="space-y-5"><section className="rounded-[22px] border border-[#e0e7e2] bg-white p-5"><h2 className="font-display font-bold">Top contributors</h2><div className="mt-4 space-y-3">{topContributors.map(([userId, count], index) => <div key={userId} className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-[#e8f2ec] text-[10px] font-bold text-[#286b50]">{index + 1}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold">{profileNames.get(userId) ?? "Member"}</span><b className="text-xs text-[#397258]">{count}</b></div>)}{!topContributors.length && <p className="rounded-xl border border-dashed border-[#d4ded8] p-4 text-center text-xs text-[#819087]">Activity will appear after members participate.</p>}</div></section><section className="rounded-[22px] border border-[#e0e7e2] bg-[#183f30] p-5 text-white"><Users size={18} className="text-[#efc77e]"/><h3 className="font-display mt-4 font-bold">Space participation</h3><p className="mt-2 text-xs leading-5 text-[#c7d8cf]">{memberRows?.length ?? 0} tracked members have joined or received direct access.</p><p className="mt-3 text-[10px] capitalize text-[#9eb8aa]">Status: {space.status}</p></section></aside>
      </div>
    </div>
  </main>;
}
