import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Coffee, Eye, FileText, GraduationCap, Hand, Hash, LockKeyhole, Megaphone, MessageCircle, Plus, Search, Settings, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { createCommunitySpace, createCommunitySpaceGroup, moveCommunitySpace } from "@/app/actions/community";
import { SubmitButton } from "@/components/community/submit-button";
import { getActiveOrganization, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

function SpaceIcon({ value }: { value: string | null }) {
  const iconClass = "size-[18px]";
  switch (value?.toLowerCase()) {
    case "messages":
    case "message":
    case "chat":
      return <MessageCircle className={iconClass}/>;
    case "megaphone":
    case "announcement":
      return <Megaphone className={iconClass}/>;
    case "wave":
    case "hello":
      return <Hand className={iconClass}/>;
    case "coffee":
      return <Coffee className={iconClass}/>;
    case "graduation":
    case "course":
      return <GraduationCap className={iconClass}/>;
    default:
      return value && value.length <= 4 ? <span className="text-base leading-none">{value}</span> : <Hash className={iconClass}/>;
  }
}

export default async function SpacesPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string; access?: string; group?: string; status?: string }> }) {
  const filters = await searchParams;
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) redirect("/onboarding");
  if (["suspended", "cancelled"].includes(organization.status)) redirect("/organization-unavailable");

  const supabase = await createClient();
  const [{ data: spaces, error: spacesError }, { data: groups, error: groupsError }, { data: postRows }, { data: accessRows }, { data: spaceLimit }] = await Promise.all([
    supabase.from("spaces").select("id, group_id, name, slug, description, kind, icon, cover_url, accent_color, visibility, status, position, created_at").eq("tenant_id", organization.id).order("position").order("created_at"),
    supabase.from("space_groups").select("id, name, position").eq("tenant_id", organization.id).order("position").order("created_at"),
    supabase.from("posts").select("space_id").eq("tenant_id", organization.id).eq("status", "published"),
    supabase.from("space_members").select("space_id").eq("tenant_id", organization.id),
    supabase.rpc("get_tenant_entitlement", { check_tenant_id: organization.id, check_entitlement_key: "spaces.max" }),
  ]);
  if (spacesError) throw new Error(`Unable to load spaces: ${spacesError.message}`);
  if (groupsError) throw new Error(`Unable to load space groups: ${groupsError.message}`);

  const postCounts = new Map<string, number>();
  for (const row of postRows ?? []) postCounts.set(row.space_id, (postCounts.get(row.space_id) ?? 0) + 1);
  const accessCounts = new Map<string, number>();
  for (const row of accessRows ?? []) accessCounts.set(row.space_id, (accessCounts.get(row.space_id) ?? 0) + 1);
  const canManage = ["owner", "admin"].includes(organization.role);
  const privateCount = (spaces ?? []).filter((space) => space.visibility === "private").length;
  const query = filters.q?.trim().toLowerCase() ?? "";
  const kind = ["discussion", "chat", "course", "event", "members", "custom"].includes(filters.kind ?? "") ? filters.kind : "all";
  const access = ["members", "private"].includes(filters.access ?? "") ? filters.access : "all";
  const group = filters.group === "ungrouped" || (groups ?? []).some((item) => item.id === filters.group) ? filters.group : "all";
  const status = ["draft", "published", "archived"].includes(filters.status ?? "") ? filters.status : "all";
  const groupNames = new Map((groups ?? []).map((item) => [item.id, item.name]));
  const filteredSpaces = (spaces ?? []).filter((space) => {
    const matchesQuery = !query || `${space.name} ${space.description ?? ""} ${space.slug}`.toLowerCase().includes(query);
    const matchesGroup = group === "all" || (group === "ungrouped" ? !space.group_id : space.group_id === group);
    return matchesQuery && matchesGroup && (kind === "all" || space.kind === kind) && (access === "all" || space.visibility === access) && (status === "all" || space.status === status);
  });

  return <main className="min-h-screen bg-[#f5f7f5] text-[#18251f]">
    <header className="sticky top-0 z-20 border-b border-[#e0e7e2] bg-white/90 px-4 backdrop-blur-xl sm:px-7">
      <div className="mx-auto flex min-h-16 max-w-[1280px] items-center gap-3 py-2">
        <Link href="/dashboard" aria-label="Back to workspace" className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#dfe6e1] text-[#607168] hover:bg-[#f3f6f4]"><ArrowLeft size={16}/></Link>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#183f30] font-display text-sm font-bold text-white">{organization.name[0]?.toUpperCase()}</span>
        <div className="min-w-0"><b className="font-display block truncate text-sm">{organization.name}</b><span className="block text-[10px] uppercase tracking-[.14em] text-[#839087]">Community administration</span></div>
        <nav aria-label="Community tools" className="ml-auto flex rounded-xl border border-[#dfe6e1] bg-[#f7f9f7] p-1 text-[10px] font-bold sm:text-xs">
          {canManage && <Link href="/spaces/templates" className="rounded-lg px-3 py-2 text-[#6d7c74] hover:text-[#205f46]"><span className="hidden sm:inline">Templates</span><Sparkles className="sm:hidden" size={14}/></Link>}
          <Link href="/spaces" aria-current="page" className="rounded-lg bg-white px-3 py-2 text-[#205f46] shadow-sm">Spaces</Link>
          <Link href="/community" className="rounded-lg px-3 py-2 text-[#6d7c74] hover:text-[#205f46]">Posts &amp; media</Link>
        </nav>
      </div>
    </header>

    <div className="mx-auto max-w-[1280px] p-4 sm:p-7">
      <section className="rounded-[26px] bg-[#183f30] p-6 text-white sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#b3d4c3]">Community structure</span><h1 className="font-display mt-2 text-3xl font-bold">Spaces</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#c9dad2]">Organize conversations into focused destinations. Control who can enter each space, then manage its identity and content rules.</p></div>{canManage && <a href="#new-space" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-[#183f30]"><Plus size={15}/> New space</a>}</div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-3">
        {[["Total spaces", `${spaces?.length ?? 0} / ${Number(spaceLimit ?? 0).toLocaleString()}`, Hash], ["Published posts", postRows?.length ?? 0, FileText], ["Private spaces", privateCount, LockKeyhole]].map(([label, value, Icon]) => { const MetricIcon = Icon as typeof Hash; return <div key={String(label)} className="rounded-[20px] border border-[#e0e7e2] bg-white p-5"><div className="flex items-center justify-between"><span className="text-xs text-[#74827a]">{String(label)}</span><MetricIcon size={16} className="text-[#317657]"/></div><b className="font-display mt-3 block text-2xl">{String(value)}</b></div>; })}
      </section>

      <form action="/spaces" className="mt-5 grid gap-3 rounded-[20px] border border-[#e0e7e2] bg-white p-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_140px_140px_140px_140px_auto]">
        <label className="relative"><span className="sr-only">Search spaces</span><Search className="absolute left-3 top-3 text-[#8a968f]" size={15}/><input name="q" defaultValue={filters.q ?? ""} placeholder="Search by name, URL, or description" className="h-10 w-full rounded-xl border border-[#dce5df] pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-[#b9d8c8]"/></label>
        <label><span className="sr-only">Space format</span><select name="kind" defaultValue={kind} className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-xs"><option value="all">All formats</option><option value="discussion">Discussion</option><option value="chat">Chat</option><option value="course">Course</option><option value="event">Event</option><option value="members">Member directory</option><option value="custom">Custom</option></select></label>
        <label><span className="sr-only">Space access</span><select name="access" defaultValue={access} className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-xs"><option value="all">All access</option><option value="members">All members</option><option value="private">Private only</option></select></label>
        <label><span className="sr-only">Space group</span><select name="group" defaultValue={group} className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-xs"><option value="all">All groups</option>{(groups ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="ungrouped">Ungrouped</option></select></label>
        <label><span className="sr-only">Space status</span><select name="status" defaultValue={status} className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-xs"><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
        <div className="flex gap-2"><button className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#183f30] px-4 text-xs font-bold text-white"><SlidersHorizontal size={14}/> Filter</button>{(query || kind !== "all" || access !== "all" || group !== "all" || status !== "all") && <Link href="/spaces" className="grid h-10 place-items-center rounded-xl border border-[#dce5df] px-3 text-xs font-semibold text-[#627269]">Reset</Link>}</div>
      </form>

      <div className={`mt-5 grid gap-5 ${canManage ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <section className="overflow-hidden rounded-[22px] border border-[#e0e7e2] bg-white">
          <div className="flex items-start justify-between gap-3 border-b border-[#e8edea] p-5"><div><h2 className="font-display font-bold">Space directory</h2><p className="mt-1 text-xs text-[#7b8981]">Choose “View posts” for member content or “Settings” to manage the space itself.</p></div><span className="shrink-0 rounded-full bg-[#edf3ef] px-2.5 py-1 text-[10px] font-bold text-[#507062]">{filteredSpaces.length} shown</span></div>
          <div className="divide-y divide-[#edf1ee]">{filteredSpaces.map((space) => <article key={space.id} className="p-5 hover:bg-[#fafcfb]">
            <div className="flex items-start gap-3 sm:gap-4"><span aria-hidden="true" className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#edf4f0] text-[#2c6d51]"><SpaceIcon value={space.icon}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-display min-w-0 break-words font-bold">{space.name}</h3><span className="rounded-full bg-[#eef2ef] px-2 py-1 text-[9px] font-bold capitalize text-[#65756c]">{space.kind}</span>{space.group_id && <span className="rounded-full bg-[#e8eef8] px-2 py-1 text-[9px] font-bold text-[#536b91]">{groupNames.get(space.group_id)}</span>}{space.visibility === "private" && <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0e8] px-2 py-1 text-[9px] font-bold text-[#9a572a]"><LockKeyhole size={10}/> Private</span>}</div><p className="mt-1 break-words text-xs leading-5 text-[#78867e]">{space.description || "No description has been added yet."}</p><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-[#87938c]"><span className="inline-flex items-center gap-1"><MessageCircle size={12}/>{postCounts.get(space.id) ?? 0} posts</span>{space.visibility === "private" && <span className="inline-flex items-center gap-1"><Users size={12}/>{accessCounts.get(space.id) ?? 0} direct members</span>}<span className="min-w-0 break-all">/community/{space.slug}</span></div></div></div>
            <div className="mt-4 flex flex-wrap gap-2 pl-0 sm:pl-[60px]"><Link href={`/community?space=${space.id}`} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#183f30] px-3 text-[10px] font-bold text-white"><Eye size={13}/> View posts</Link>{canManage && <><Link href={`/community/spaces/${space.id}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#dce5df] px-3 text-[10px] font-bold text-[#52675b]"><Settings size={13}/> Settings</Link><div className="ml-auto flex overflow-hidden rounded-xl border border-[#dce5df] bg-white"><form action={moveCommunitySpace}><input type="hidden" name="spaceId" value={space.id}/><input type="hidden" name="direction" value="up"/><button aria-label={`Move ${space.name} up`} title="Move up" className="grid size-9 place-items-center text-[#607168] hover:bg-[#edf3ef]"><ArrowUp size={13}/></button></form><form action={moveCommunitySpace} className="border-l border-[#dce5df]"><input type="hidden" name="spaceId" value={space.id}/><input type="hidden" name="direction" value="down"/><button aria-label={`Move ${space.name} down`} title="Move down" className="grid size-9 place-items-center text-[#607168] hover:bg-[#edf3ef]"><ArrowDown size={13}/></button></form></div></>}</div>
          </article>)}{!filteredSpaces.length && <div className="p-10 text-center"><Hash className="mx-auto text-[#789084]"/><h2 className="font-display mt-3 font-bold">{(spaces ?? []).length ? "No matching spaces" : "No spaces yet"}</h2><p className="mt-2 text-xs text-[#7b8981]">{(spaces ?? []).length ? "Try a broader search or reset the filters." : "Create the first destination for your community."}</p></div>}</div>
        </section>

        {canManage && <aside id="new-space" className="h-fit scroll-mt-24 rounded-[22px] border border-[#dce5df] bg-white p-5">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#e8f2ec] text-[#286b50]"><Plus size={17}/></span><div><h2 className="font-display font-bold">Create a space</h2><p className="text-[10px] text-[#7c8982]">Add a new community destination</p></div></div>
          <form action={createCommunitySpace} className="mt-5 space-y-3">
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-[#627269]">Name</span><input name="name" required minLength={2} maxLength={80} placeholder="Announcements" className="h-10 w-full rounded-xl border border-[#dce5df] px-3 text-xs outline-none focus:ring-2 focus:ring-[#b9d8c8]"/></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-[#627269]">URL slug</span><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="announcements" className="h-10 w-full rounded-xl border border-[#dce5df] px-3 text-xs outline-none focus:ring-2 focus:ring-[#b9d8c8]"/></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-[#627269]">Format</span><select name="kind" className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-xs"><option value="discussion">Discussion</option><option value="chat">Chat</option><option value="course">Course</option><option value="event">Event</option><option value="members">Members</option><option value="custom">Custom</option></select></label>
              <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-[#627269]">Access</span><select name="visibility" className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-xs"><option value="members">All members</option><option value="private">Private</option></select></label>
            </div>
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-[#627269]">Description</span><textarea name="description" maxLength={280} placeholder="Explain what members should share here…" className="min-h-24 w-full resize-y rounded-xl border border-[#dce5df] p-3 text-xs outline-none focus:ring-2 focus:ring-[#b9d8c8]"/></label>
            <SubmitButton className="h-10 w-full rounded-xl bg-[#183f30] text-xs font-semibold text-white">Create space</SubmitButton>
          </form>
          <div className="my-6 border-t border-[#e5ebe7]"/>
          <div><h3 className="font-display text-sm font-bold">Space groups</h3><p className="mt-1 text-[10px] leading-4 text-[#7c8982]">Create categories for onboarding, community, learning, and other collections.</p></div>
          <div className="mt-3 flex flex-wrap gap-2">{(groups ?? []).map((item) => <span key={item.id} className="rounded-full bg-[#edf3ef] px-2.5 py-1 text-[10px] font-semibold text-[#52675b]">{item.name}</span>)}{!(groups ?? []).length && <span className="text-[10px] text-[#8a968f]">No groups yet</span>}</div>
          <form action={createCommunitySpaceGroup} className="mt-4 flex gap-2"><input name="name" required maxLength={60} placeholder="New group name" className="h-10 min-w-0 flex-1 rounded-xl border border-[#dce5df] px-3 text-xs outline-none focus:ring-2 focus:ring-[#b9d8c8]"/><SubmitButton className="h-10 rounded-xl bg-[#e8f2ec] px-3 text-xs font-semibold text-[#246749]">Add</SubmitButton></form>
        </aside>}
      </div>
      <p className="mt-6 text-center text-[10px] text-[#8a968f]">Signed in as {user.displayName} · {organization.role}</p>
    </div>
  </main>;
}
