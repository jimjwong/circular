import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, BriefcaseBusiness, Filter, MapPin, Pencil, Search, Settings2, Sparkles, Users } from "lucide-react";
import { loadMemberDirectory, memberInitials, membershipLabel } from "@/lib/members/directory";

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; tier?: string; tag?: string; interest?: string; location?: string }> }) {
  const filters = await searchParams;
  const { organization, user, canManage, viewerTier, entries, tags, assignments } = await loadMemberDirectory();
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const tagsByUser = new Map<string, typeof tags>();
  for (const assignment of assignments) {
    const tag = tagById.get(assignment.tag_id);
    if (!tag) continue;
    tagsByUser.set(assignment.user_id, [...(tagsByUser.get(assignment.user_id) ?? []), tag]);
  }

  const q = filters.q?.trim().toLowerCase() ?? "";
  const filtered = entries.filter((entry) => {
    const memberTags = tagsByUser.get(entry.user_id) ?? [];
    const searchable = [entry.display_name, entry.headline, entry.location, entry.bio, ...entry.interests, ...memberTags.map((tag) => tag.name), ...Object.values(entry.custom_values ?? {}).map(String)].join(" ").toLowerCase();
    return (!q || searchable.includes(q))
      && (!filters.tier || filters.tier === "all" || entry.membership_tier === filters.tier)
      && (!filters.tag || filters.tag === "all" || memberTags.some((tag) => tag.id === filters.tag))
      && (!filters.interest || entry.interests.some((interest) => interest.toLowerCase().includes(filters.interest!.toLowerCase())))
      && (!filters.location || entry.location?.toLowerCase().includes(filters.location.toLowerCase()));
  });
  const distinctInterests = new Set(entries.flatMap((entry) => entry.interests.map((interest) => interest.toLowerCase()))).size;
  const activeCount = entries.filter((entry) => entry.activity_score >= 50).length;

  return <main className="min-h-screen bg-[#f5f7f5] text-[#18251f]">
    <header className="sticky top-0 z-20 border-b border-[#e0e7e2] bg-white/90 px-4 backdrop-blur-xl sm:px-7"><div className="mx-auto flex h-16 max-w-7xl items-center gap-3"><Link href="/community" aria-label="Back to community" className="grid size-9 place-items-center rounded-xl border border-[#dfe6e1] text-[#607168]"><ArrowLeft size={16}/></Link><span className="grid size-9 place-items-center rounded-xl bg-[#183f30] font-display text-sm font-bold text-white">{organization.name[0]}</span><div><b className="font-display block text-sm">{organization.name}</b><span className="text-[10px] text-[#839087]">Member directory</span></div><nav className="ml-auto flex items-center gap-2"><Link href="/members/me/edit" className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#dce5df] bg-white px-3 text-[10px] font-bold text-[#456254]"><Pencil size={13}/> Edit my profile</Link>{canManage && <Link href="/members/manage" className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#183f30] px-3 text-[10px] font-bold text-white"><Settings2 size={13}/> <span className="hidden sm:inline">Manage directory</span></Link>}</nav></div></header>

    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-7">
      <section className="overflow-hidden rounded-[26px] bg-gradient-to-br from-[#183f30] to-[#2d7558] p-6 text-white sm:p-8"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-2xl"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a8d0bc]">People make the community</span><h1 className="font-display mt-2 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Find expertise, collaborators, and generous peers.</h1><p className="mt-3 text-sm leading-6 text-[#cee0d7]">Explore {entries.length} visible profiles across {distinctInterests} shared interests.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Stat value={entries.length} label="Members"/><Stat value={activeCount} label="Active"/><Stat value={tags.length} label="Tags"/></div></div></section>

      {viewerTier === "guest" && !canManage && <section className="rounded-[22px] border border-[#ead7ba] bg-[#fff8ea] p-5 text-sm text-[#70552a]"><b>Guest directory access is limited.</b><p className="mt-1 text-xs leading-5">You can view and edit your own profile. Associate, Professional, and Corporate membership unlocks member discovery.</p></section>}

      <form className="grid gap-3 rounded-[22px] border border-[#e0e7e2] bg-white p-4 md:grid-cols-[minmax(220px,1fr)_160px_180px_auto]"><label className="relative"><span className="sr-only">Search members</span><Search className="absolute left-3 top-3 text-[#8a968f]" size={15}/><input name="q" defaultValue={filters.q} placeholder="Search name, expertise, interest…" className="h-10 w-full rounded-xl border border-[#dce5df] pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-[#b9d8c8]"/></label><select name="tier" defaultValue={filters.tier ?? "all"} className="h-10 rounded-xl border border-[#dce5df] bg-white px-3 text-xs"><option value="all">All membership levels</option><option value="associate">Associate</option><option value="professional">Professional</option><option value="corporate">Corporate</option>{canManage && <option value="guest">Guest</option>}</select><select name="tag" defaultValue={filters.tag ?? "all"} className="h-10 rounded-xl border border-[#dce5df] bg-white px-3 text-xs"><option value="all">All tags</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select><button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#183f30] px-4 text-xs font-bold text-white"><Filter size={14}/> Apply</button></form>

      <div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-bold">{filtered.length} {filtered.length === 1 ? "member" : "members"}</h2><p className="mt-1 text-xs text-[#77867d]">Profiles respect each member’s directory privacy settings.</p></div>{(filters.q || filters.tier || filters.tag) && <Link href="/members" className="text-xs font-bold text-[#397258]">Clear filters</Link>}</div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((entry) => {
        const memberTags = tagsByUser.get(entry.user_id) ?? [];
        return <Link href={`/members/${entry.user_id}`} key={entry.user_id} className="group rounded-[22px] border border-[#e0e7e2] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#b9d2c3] hover:shadow-[0_12px_35px_rgba(24,63,48,.08)]"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#e8f3ed] text-sm font-bold text-[#286f53]">{entry.avatar_url ? <Image src={entry.avatar_url} alt="" width={48} height={48} unoptimized className="size-full object-cover"/> : memberInitials(entry.display_name)}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate font-display font-bold group-hover:text-[#286f53]">{entry.display_name}</h3>{entry.user_id === user.id && <span className="rounded-full bg-[#edf3ef] px-2 py-0.5 text-[8px] font-bold uppercase text-[#587065]">You</span>}</div><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#718078]">{entry.headline || "Community member"}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-[#edf4f0] px-2.5 py-1 text-[9px] font-bold text-[#326f54]">{membershipLabel(entry.membership_tier)}</span>{entry.location && <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f6f4] px-2.5 py-1 text-[9px] text-[#6f7d75]"><MapPin size={10}/>{entry.location}</span>}</div>{entry.interests.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{entry.interests.slice(0, 3).map((interest) => <span key={interest} className="rounded-lg border border-[#e3e9e5] px-2 py-1 text-[9px] text-[#5f7167]">{interest}</span>)}</div>}{memberTags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[#edf1ee] pt-4">{memberTags.slice(0, 3).map((tag) => <span key={tag.id} className="inline-flex items-center gap-1 text-[9px] font-semibold" style={{ color: tag.color }}><span className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }}/>{tag.name}</span>)}</div>}<div className="mt-5 flex items-center justify-between text-[10px] text-[#87938c]"><span className="inline-flex items-center gap-1"><BriefcaseBusiness size={11}/>{entry.account_role}</span>{entry.show_activity && <span className="inline-flex items-center gap-1"><Sparkles size={11}/>{entry.activity_score} activity</span>}</div></Link>;
      })}</section>
      {!filtered.length && <section className="rounded-[22px] border border-dashed border-[#cdd9d2] bg-white p-12 text-center"><Users className="mx-auto text-[#789084]"/><h2 className="font-display mt-3 font-bold">No matching members</h2><p className="mt-2 text-xs text-[#7b8981]">Try a broader search or clear the current filters.</p></section>}
    </div>
  </main>;
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="min-w-24 rounded-2xl bg-white/10 p-4"><b className="font-display block text-2xl">{value}</b><span className="text-[10px] text-[#c8ddd2]">{label}</span></div>;
}
