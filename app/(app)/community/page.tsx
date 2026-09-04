import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bell, CheckCircle2, ChevronLeft, ChevronRight, FileText, Hash, Heart, MapPin, MessageCircle, Pencil, Pin, Plus, Send, Settings, Sparkles, Trash2, UserRoundPlus, Users } from "lucide-react";
import {
  createCommunityComment,
  createCommunityPost,
  createCommunitySpace,
  deleteCommunityAttachment,
  deleteCommunityComment,
  deleteCommunityPost,
  setCommunityPostPinned,
  toggleCommunityReaction,
  toggleCommunitySpaceMembership,
  updateCommunityPost,
} from "@/app/actions/community";
import { SubmitButton } from "@/components/community/submit-button";
import { MediaUploader } from "@/components/community/media-uploader";
import { RealtimeRefresh } from "@/components/community/realtime-refresh";
import { getActiveOrganization, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function bodyText(body: unknown) {
  if (body && typeof body === "object" && "text" in body && typeof body.text === "string") return body.text;
  return "";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ page?: string; introduced?: string; space?: string }> }) {
  const query = await searchParams;
  const requestedSpaceId = query.space && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query.space) ? query.space : undefined;
  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 10;
  const pageStart = (currentPage - 1) * pageSize;
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) redirect("/onboarding");
  if (["suspended", "cancelled"].includes(organization.status)) redirect("/organization-unavailable");

  const supabase = await createClient();
  let postQuery = supabase.from("posts").select("id, space_id, author_id, title, body, is_pinned, published_at, created_at", { count: "exact" }).eq("tenant_id", organization.id).eq("status", "published");
  if (requestedSpaceId) postQuery = postQuery.eq("space_id", requestedSpaceId);
  const [
    { data: spaces, error: spaceError },
    { data: posts, error: postError, count: postCount },
    { data: comments },
    { data: reactions },
    { data: attachments },
    { count: unreadNotifications },
    { count: memberCount },
    { data: memberLimit },
    { data: onboardingRows, error: onboardingError },
    { data: spacePostRows },
    { data: ownSpaceMemberships },
    { data: ownModeratorRows },
  ] = await Promise.all([
    supabase.from("spaces").select("id, name, slug, description, kind, icon, cover_url, accent_color, membership_mode, layout, show_right_sidebar, show_members_tab, posting_permission, commenting_permission, created_at").eq("tenant_id", organization.id).eq("status", "published").order("position").order("created_at"),
    postQuery.order("is_pinned", { ascending: false }).order("published_at", { ascending: false }).range(pageStart, pageStart + pageSize - 1),
    supabase.from("comments").select("id, post_id, parent_id, author_id, body, created_at").eq("tenant_id", organization.id).order("created_at"),
    supabase.from("reactions").select("post_id, user_id, emoji").eq("tenant_id", organization.id).not("post_id", "is", null),
    supabase.from("post_attachments").select("id, post_id, uploaded_by, storage_path, file_name, content_type, size_bytes").eq("tenant_id", organization.id).order("created_at"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
    supabase.from("tenant_memberships").select("user_id", { count: "exact", head: true }).eq("tenant_id", organization.id).eq("status", "active"),
    supabase.rpc("get_tenant_entitlement", { check_tenant_id: organization.id, check_entitlement_key: "members.max" }),
    supabase.from("member_onboarding").select("user_id, introduction_post_id, completed_at").eq("tenant_id", organization.id).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(8),
    supabase.from("posts").select("space_id").eq("tenant_id", organization.id).eq("status", "published"),
    supabase.from("space_members").select("space_id").eq("tenant_id", organization.id).eq("user_id", user.id),
    supabase.from("space_moderators").select("space_id").eq("tenant_id", organization.id).eq("user_id", user.id),
  ]);
  if (spaceError) throw new Error(`Unable to load spaces: ${spaceError.message}`);
  if (postError) throw new Error(`Unable to load posts: ${postError.message}`);
  if (onboardingError) throw new Error(`Unable to load member onboarding: ${onboardingError.message}`);
  const activeSpace = requestedSpaceId ? (spaces ?? []).find((space) => space.id === requestedSpaceId) : undefined;
  if (requestedSpaceId && !activeSpace) redirect("/community");

  const authorIds = [...new Set([user.id, ...(posts ?? []).map((post) => post.author_id), ...(comments ?? []).map((comment) => comment.author_id), ...(onboardingRows ?? []).map((row) => row.user_id)])];
  const { data: profiles } = authorIds.length
    ? await supabase.from("profiles").select("id, display_name, headline, location, bio, interests").in("id", authorIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || "Member"]));
  names.set(user.id, user.displayName);
  const spaceNames = new Map((spaces ?? []).map((space) => [space.id, space.name]));
  const attachmentRows = await Promise.all((attachments ?? []).map(async (attachment) => {
    const { data } = await supabase.storage.from("community-media").createSignedUrl(attachment.storage_path, 3600);
    return { ...attachment, signedUrl: data?.signedUrl ?? "" };
  }));
  const attachmentsByPost = new Map<string, typeof attachmentRows>();
  for (const attachment of attachmentRows) {
    const current = attachmentsByPost.get(attachment.post_id) ?? [];
    current.push(attachment);
    attachmentsByPost.set(attachment.post_id, current);
  }
  const commentsByPost = new Map<string, typeof comments>();
  for (const comment of comments ?? []) {
    const current = commentsByPost.get(comment.post_id) ?? [];
    current.push(comment);
    commentsByPost.set(comment.post_id, current);
  }
  const reactionCounts = new Map<string, number>();
  const reactedByCurrentUser = new Set<string>();
  for (const reaction of reactions ?? []) {
    if (!reaction.post_id) continue;
    reactionCounts.set(reaction.post_id, (reactionCounts.get(reaction.post_id) ?? 0) + 1);
    if (reaction.user_id === user.id && reaction.emoji === "heart") reactedByCurrentUser.add(reaction.post_id);
  }
  const canManageSpaces = ["owner", "admin"].includes(organization.role);
  const canModerate = ["owner", "admin", "moderator"].includes(organization.role);
  const canUseRestrictedContent = ["owner", "admin", "moderator"].includes(organization.role);
  const joinedSpaceIds = new Set((ownSpaceMemberships ?? []).map((row) => row.space_id));
  const moderatedSpaceIds = new Set((ownModeratorRows ?? []).map((row) => row.space_id));
  const postableSpaces = (spaces ?? []).filter((space) => space.posting_permission === "members" || canUseRestrictedContent || moderatedSpaceIds.has(space.id));
  const activeSpaceIsPostable = !activeSpace || postableSpaces.some((space) => space.id === activeSpace.id);
  const totalPages = Math.max(1, Math.ceil((postCount ?? 0) / pageSize));
  const ownOnboarding = (onboardingRows ?? []).find((row) => row.user_id === user.id);
  const hasIntroduction = Boolean(ownOnboarding?.completed_at);
  const newMembers = (onboardingRows ?? []).map((row) => ({ ...row, profile: profileById.get(row.user_id) })).filter((row) => row.profile).slice(0, 5);
  const spacePostCounts = new Map<string, number>();
  for (const row of spacePostRows ?? []) spacePostCounts.set(row.space_id, (spacePostCounts.get(row.space_id) ?? 0) + 1);
  const pageHref = (page: number) => ({
    pathname: "/community" as const,
    query: {
      ...(activeSpace ? { space: activeSpace.id } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
    },
  });

  return <main className="min-h-screen bg-[#f5f7f5] text-[#18251f]">
    <RealtimeRefresh tenantId={organization.id}/>
    <header className="sticky top-0 z-20 border-b border-[#e0e7e2] bg-white/90 px-4 backdrop-blur-xl sm:px-7">
      <div className="mx-auto flex h-16 max-w-[1420px] items-center gap-3"><Link href="/dashboard" aria-label="Back to workspace" className="grid size-9 place-items-center rounded-xl border border-[#dfe6e1] text-[#607168] hover:bg-[#f3f6f4]"><ArrowLeft size={16}/></Link><span className="grid size-9 place-items-center rounded-xl bg-[#183f30] font-display text-sm font-bold text-white">{organization.name[0]?.toUpperCase()}</span><div className="min-w-0"><b className="font-display block truncate text-sm">{organization.name}</b><span className="block text-[10px] uppercase tracking-[.14em] text-[#839087]">Community</span></div><div className="ml-auto flex items-center gap-2"><Link href="/community/introduce" className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#183f30] px-3 text-[10px] font-bold text-white hover:bg-[#245841]"><UserRoundPlus size={14}/><span className="hidden sm:inline">{hasIntroduction ? "Edit my introduction" : "Create my introduction"}</span></Link><Link href="/notifications" aria-label={`${unreadNotifications ?? 0} unread notifications`} className="relative grid size-9 place-items-center rounded-xl border border-[#dfe6e1] text-[#607168] hover:bg-[#f3f6f4]"><Bell size={15}/>{Boolean(unreadNotifications) && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[8px] font-bold leading-4 text-white">{Math.min(unreadNotifications ?? 0, 99)}</span>}</Link><span className="hidden rounded-full bg-[#e9f3ed] px-3 py-1.5 text-[10px] font-semibold capitalize text-[#286b50] sm:block">{organization.role}</span><span className="grid size-8 place-items-center rounded-full bg-[#ffead8] text-[10px] font-bold text-[#9b5c26]">{user.initials}</span></div></div>
    </header>

    <div className="mx-auto max-w-[1420px] p-4 sm:p-7">
      <nav aria-label="Community tools" className="mb-5 flex w-fit rounded-xl border border-[#dfe6e1] bg-[#eef2ef] p-1 text-xs font-bold">
        <Link href="/spaces" className="rounded-lg px-4 py-2 text-[#6d7c74] hover:text-[#205f46]">Spaces</Link>
        <Link href="/community" aria-current="page" className="rounded-lg bg-white px-4 py-2 text-[#205f46] shadow-sm">Posts &amp; media</Link>
      </nav>
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        {[["Spaces", spaces?.length ?? 0, Hash], [activeSpace ? `${activeSpace.name} posts` : "Published posts", postCount ?? 0, Send], ["Active members", `${memberCount ?? 0} / ${Number(memberLimit ?? 0).toLocaleString()}`, Users]].map(([label, value, Icon]) => { const MetricIcon = Icon as typeof Hash; return <div key={String(label)} className="rounded-[20px] border border-[#e0e7e2] bg-white p-5"><div className="flex items-center justify-between"><span className="text-xs text-[#74827a]">{String(label)}</span><MetricIcon size={16} className="text-[#317657]"/></div><b className="font-display mt-3 block text-2xl">{String(value)}</b></div>; })}
      </section>

      <div className={`grid gap-5 ${activeSpace && !activeSpace.show_right_sidebar ? "xl:grid-cols-[260px_minmax(0,1fr)]" : "xl:grid-cols-[260px_minmax(0,1fr)_260px]"}`}>
        <aside className="space-y-5">
          <section className="rounded-[22px] border border-[#e0e7e2] bg-white p-4"><div className="flex items-center justify-between px-1"><h2 className="font-display font-bold">Spaces</h2><span className="rounded-full bg-[#edf3ef] px-2 py-1 text-[10px] font-bold text-[#507062]">{spaces?.length ?? 0}</span></div><nav className="mt-3 space-y-1"><Link href="/community" aria-current={!activeSpace ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold ${!activeSpace ? "bg-[#183f30] text-white" : "text-[#617168] hover:bg-[#f4f7f5]"}`}><Send size={14}/><span className="flex-1">All activity</span><small className={activeSpace ? "text-[#93a098]" : "text-white/65"}>{spacePostRows?.length ?? 0}</small></Link>{(spaces ?? []).map((space) => { const selected = activeSpace?.id === space.id; return <div key={space.id} className={`flex items-center rounded-xl ${selected ? "bg-[#e8f2ec] text-[#246749]" : "text-[#617168] hover:bg-[#f4f7f5]"}`}><Link href={`/community?space=${space.id}`} aria-current={selected ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-xs font-semibold"><Hash size={14}/><span className="truncate">{space.name}</span><small className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] ${selected ? "bg-white/70 text-[#397258]" : "bg-[#f0f3f1] text-[#8b968f]"}`}>{spacePostCounts.get(space.id) ?? 0}</small></Link>{canManageSpaces && <Link href={`/community/spaces/${space.id}`} aria-label={`Settings for ${space.name}`} title={`Settings for ${space.name}`} className="mr-1 grid size-7 place-items-center rounded-lg hover:bg-white/70"><Settings size={13}/></Link>}</div>; })}</nav></section>
          {canManageSpaces && <section className="rounded-[22px] border border-[#e0e7e2] bg-white p-4"><div className="flex items-center gap-2"><Plus size={15} className="text-[#317657]"/><h2 className="font-display text-sm font-bold">Create a space</h2></div><form action={createCommunitySpace} className="mt-4 space-y-3"><input name="name" required minLength={2} maxLength={80} placeholder="Space name" className="h-10 w-full rounded-xl border border-[#dce5df] px-3 text-xs outline-none focus:ring-2 focus:ring-[#b9d8c8]"/><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="space-url" className="h-10 w-full rounded-xl border border-[#dce5df] px-3 text-xs outline-none focus:ring-2 focus:ring-[#b9d8c8]"/><select name="kind" className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-xs"><option value="discussion">Discussion</option><option value="chat">Chat</option></select><textarea name="description" maxLength={280} placeholder="What belongs here?" className="min-h-20 w-full resize-none rounded-xl border border-[#dce5df] p-3 text-xs outline-none focus:ring-2 focus:ring-[#b9d8c8]"/><SubmitButton className="h-10 w-full rounded-xl bg-[#183f30] text-xs font-semibold text-white">Create space</SubmitButton></form></section>}
        </aside>

        <div className="space-y-5">
          {query.introduced === "1" && <section role="status" className="flex items-center gap-3 rounded-[20px] border border-[#b9d8c8] bg-[#eaf5ef] p-4 text-[#246b4e]"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-white"><CheckCircle2 size={17}/></span><div><b className="block text-sm">Your introduction is live.</b><p className="mt-0.5 text-xs text-[#527564]">Members can now welcome you with replies and reactions.</p></div></section>}
          {!hasIntroduction && <section className="overflow-hidden rounded-[22px] border border-[#d9e5dd] bg-gradient-to-br from-[#183f30] to-[#2e7659] p-5 text-white sm:p-6"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/12"><Sparkles size={20} className="text-[#f1ce88]"/></span><div className="min-w-0 flex-1"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#a9cfbc]">Your first community step</span><h1 className="font-display mt-1 text-xl font-bold">Introduce yourself to the community</h1><p className="mt-2 max-w-xl text-xs leading-5 text-[#d0e0d8]">Complete your profile and publish a welcoming post in one guided step.</p><Link href="/community/introduce" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-[#183f30]">Create my introduction <UserRoundPlus size={14}/></Link></div></div></section>}
          {activeSpace && <section className="overflow-hidden rounded-[22px] border border-[#dbe5df] bg-white">{activeSpace.cover_url && <div role="img" aria-label={`${activeSpace.name} cover`} className="h-36 bg-cover bg-center sm:h-44" style={{ backgroundImage: `linear-gradient(90deg, rgba(12,31,23,.16), rgba(12,31,23,.04)), url(${JSON.stringify(activeSpace.cover_url)})` }}/>}<div className="flex items-start gap-4 p-5 sm:p-6"><span className="grid size-11 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `${activeSpace.accent_color}18`, color: activeSpace.accent_color }}><Hash size={19}/></span><div className="min-w-0 flex-1"><span className="text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: activeSpace.accent_color }}>{activeSpace.kind} space{moderatedSpaceIds.has(activeSpace.id) ? " · You moderate" : ""}</span><h1 className="font-display mt-1 text-2xl font-bold">{activeSpace.name}</h1><p className="mt-2 text-sm leading-6 text-[#6d7c74]">{activeSpace.description || "A focused place for this community to connect and share."}</p></div><div className="flex shrink-0 flex-col gap-2">{activeSpace.membership_mode === "optional" && <form action={toggleCommunitySpaceMembership}><input type="hidden" name="spaceId" value={activeSpace.id}/><input type="hidden" name="intent" value={joinedSpaceIds.has(activeSpace.id) ? "leave" : "join"}/><SubmitButton className="h-9 rounded-xl bg-[#e8f2ec] px-3 text-[10px] font-bold text-[#246749]">{joinedSpaceIds.has(activeSpace.id) ? "Leave space" : "Join space"}</SubmitButton></form>}{canManageSpaces && <Link href={`/community/spaces/${activeSpace.id}`} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#dce5df] px-3 text-[10px] font-bold text-[#52675b]"><Settings size={13}/> Settings</Link>}</div></div></section>}
          <section className="rounded-[22px] border border-[#e0e7e2] bg-white p-5 sm:p-6"><div><span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#347457]">Start a conversation</span><h1 className="font-display mt-1 text-xl font-bold">{activeSpace ? `Share in ${activeSpace.name}` : "Share with your community"}</h1></div>{postableSpaces.length && activeSpaceIsPostable ? <form action={createCommunityPost} className="mt-5 space-y-3"><div className="grid gap-3 sm:grid-cols-[180px_1fr]"><select name="spaceId" required defaultValue={activeSpace?.id} className="h-11 rounded-xl border border-[#dce5df] bg-white px-3 text-xs font-semibold">{postableSpaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select><input name="title" required minLength={3} maxLength={160} placeholder="Give your post a clear title" className="h-11 rounded-xl border border-[#dce5df] px-3 text-sm outline-none focus:ring-2 focus:ring-[#b9d8c8]"/></div><textarea name="body" required maxLength={10000} placeholder="Write something useful, thoughtful, or worth discussing…" className="min-h-28 w-full resize-y rounded-xl border border-[#dce5df] p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-[#b9d8c8]"/><div className="flex justify-end"><SubmitButton className="h-10 rounded-xl bg-[#183f30] px-5 text-xs font-semibold text-white">Publish post</SubmitButton></div></form> : <p className="mt-4 rounded-xl bg-[#f5f8f6] p-4 text-sm text-[#6f7e76]">{activeSpace && !activeSpaceIsPostable ? "Only administrators and moderators can publish in this space." : "No spaces currently allow you to publish."}</p>}</section>

          <div className={activeSpace?.layout === "card" ? "grid gap-5 lg:grid-cols-2" : "space-y-5"}>{(posts ?? []).map((post) => {
            const postComments = commentsByPost.get(post.id) ?? [];
            const postAttachments = attachmentsByPost.get(post.id) ?? [];
            const authorName = names.get(post.author_id) ?? "Member";
            const canDelete = canModerate || post.author_id === user.id;
            const canEdit = ["owner", "admin"].includes(organization.role) || post.author_id === user.id;
            return <article key={post.id} id={`space-${post.space_id}`} className={`rounded-[22px] border border-[#e0e7e2] bg-white ${activeSpace?.layout === "list" ? "p-4" : "p-5 sm:p-6"}`}><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e4f1ea] text-[10px] font-bold text-[#276b4e]">{initials(authorName)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{authorName}</b><span className="rounded-full bg-[#eef3f0] px-2 py-1 text-[9px] font-semibold text-[#607168]"># {spaceNames.get(post.space_id) ?? "Space"}</span>{post.is_pinned && <span className="rounded-full bg-[#fff2dc] px-2 py-1 text-[9px] font-semibold text-[#966113]">Pinned</span>}</div><p className="mt-1 text-[10px] text-[#8a968f]">{dateLabel(post.published_at ?? post.created_at)}</p></div><div className="flex gap-1">{canModerate && <form action={setCommunityPostPinned}><input type="hidden" name="postId" value={post.id}/><input type="hidden" name="pinned" value={post.is_pinned ? "false" : "true"}/><button aria-label={post.is_pinned ? `Unpin ${post.title}` : `Pin ${post.title}`} title={post.is_pinned ? "Unpin post" : "Pin post"} className="grid size-8 place-items-center rounded-lg text-[#9aa49e] hover:bg-amber-50 hover:text-amber-600"><Pin size={14} fill={post.is_pinned ? "currentColor" : "none"}/></button></form>}{canDelete && <form action={deleteCommunityPost}><input type="hidden" name="postId" value={post.id}/><button aria-label={`Delete ${post.title}`} title="Delete post" className="grid size-8 place-items-center rounded-lg text-[#9aa49e] hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14}/></button></form>}</div></div><h2 className={`font-display font-bold ${activeSpace?.layout === "list" ? "mt-3 text-base" : "mt-5 text-lg"}`}>{post.title}</h2><p className={`mt-2 whitespace-pre-wrap text-sm text-[#5f6f66] ${activeSpace?.layout === "list" ? "line-clamp-2 leading-5" : "leading-6"}`}>{bodyText(post.body)}</p>
              {postAttachments.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{postAttachments.map((attachment) => { const canDeleteAttachment = canModerate || attachment.uploaded_by === user.id; return <div key={attachment.id} className="flex items-center gap-3 rounded-xl border border-[#e2e9e4] bg-[#fafcfb] p-3"><FileText size={17} className="shrink-0 text-[#397258]"/><a href={attachment.signedUrl || "#"} target="_blank" rel="noreferrer" className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[#2f5f49]">{attachment.file_name}</span><span className="text-[9px] text-[#89968f]">{Math.max(1, Math.ceil(attachment.size_bytes / 1024)).toLocaleString()} KB</span></a>{canDeleteAttachment && <form action={deleteCommunityAttachment}><input type="hidden" name="attachmentId" value={attachment.id}/><button aria-label={`Delete ${attachment.file_name}`} className="grid size-7 place-items-center rounded-lg text-[#9aa49e] hover:bg-rose-50 hover:text-rose-600"><Trash2 size={12}/></button></form>}</div>; })}</div>}
              {canEdit && <><details className="mt-4 rounded-xl border border-[#e6ece8] bg-[#fafbfa] p-3"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-[#557064]"><Pencil size={13}/> Edit post</summary><form action={updateCommunityPost} className="mt-3 space-y-2"><input type="hidden" name="postId" value={post.id}/><input name="title" defaultValue={post.title ?? ""} required minLength={3} maxLength={160} className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-xs"/><textarea name="body" defaultValue={bodyText(post.body)} required maxLength={10000} className="min-h-24 w-full rounded-xl border border-[#dce5df] bg-white p-3 text-xs leading-5"/><div className="flex justify-end"><SubmitButton className="h-9 rounded-xl bg-[#183f30] px-4 text-xs font-semibold text-white">Save post</SubmitButton></div></form></details><MediaUploader tenantId={organization.id} userId={user.id} postId={post.id}/></>}
              <div className="mt-5 flex items-center gap-4 border-t border-[#edf1ee] pt-4"><form action={toggleCommunityReaction}><input type="hidden" name="postId" value={post.id}/><input type="hidden" name="emoji" value="heart"/><button className={`flex items-center gap-1.5 text-xs font-semibold ${reactedByCurrentUser.has(post.id) ? "text-rose-600" : "text-[#68776f]"}`}><Heart size={15} fill={reactedByCurrentUser.has(post.id) ? "currentColor" : "none"}/>{reactionCounts.get(post.id) ?? 0}</button></form><span className="flex items-center gap-1.5 text-xs font-semibold text-[#68776f]"><MessageCircle size={15}/>{postComments.length}</span></div>
              <div className="mt-4 space-y-3">{postComments.slice(-6).map((comment) => { const commentAuthor = names.get(comment.author_id) ?? "Member"; const canDeleteComment = canModerate || comment.author_id === user.id; return <div key={comment.id} className={`flex gap-2.5 rounded-xl bg-[#f5f8f6] p-3 ${comment.parent_id ? "ml-5 border-l-2 border-[#bdd6c8] sm:ml-9" : ""}`}><span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-[8px] font-bold text-[#47715d]">{initials(commentAuthor)}</span><div className="min-w-0 flex-1"><p className="text-xs"><b>{commentAuthor}</b>{comment.parent_id && <span className="ml-1.5 rounded-full bg-[#e5eee9] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#557064]">reply</span>} <span className="ml-1 text-[10px] text-[#8b968f]">{dateLabel(comment.created_at)}</span></p><p className="mt-1 text-xs leading-5 text-[#5f6f66]">{comment.body}</p><details className="mt-2"><summary className="cursor-pointer list-none text-[10px] font-semibold text-[#397258]">Reply to {commentAuthor}</summary><form action={createCommunityComment} className="mt-2 flex gap-2"><input type="hidden" name="postId" value={post.id}/><input type="hidden" name="parentId" value={comment.id}/><input name="body" required maxLength={2000} aria-label={`Reply to ${commentAuthor}`} placeholder="Write a reply…" className="h-9 min-w-0 flex-1 rounded-xl border border-[#dce5df] bg-white px-3 text-xs"/><SubmitButton className="h-9 rounded-xl bg-[#dcebe2] px-3 text-[10px] font-semibold text-[#246749]">Send</SubmitButton></form></details></div>{canDeleteComment && <form action={deleteCommunityComment}><input type="hidden" name="commentId" value={comment.id}/><button aria-label="Delete comment" className="grid size-7 place-items-center rounded-lg text-[#9aa49e] hover:bg-rose-50 hover:text-rose-600"><Trash2 size={12}/></button></form>}</div>; })}</div>
              <form action={createCommunityComment} className="mt-4 flex gap-2"><input type="hidden" name="postId" value={post.id}/><input name="body" required maxLength={2000} aria-label={`Comment on ${post.title}`} placeholder="Write a comment…" className="h-10 min-w-0 flex-1 rounded-xl border border-[#dce5df] px-3 text-xs outline-none focus:ring-2 focus:ring-[#b9d8c8]"/><SubmitButton className="h-10 rounded-xl bg-[#e8f2ec] px-4 text-xs font-semibold text-[#246749]">Reply</SubmitButton></form>
            </article>;
          })}</div>
          {!(posts ?? []).length && <section className="rounded-[22px] border border-dashed border-[#ccd9d1] bg-white p-10 text-center"><MessageCircle className="mx-auto text-[#56816c]"/><h2 className="font-display mt-4 font-bold">No conversations yet</h2><p className="mt-2 text-sm text-[#7a8880]">Publish the first post{activeSpace ? ` in ${activeSpace.name}` : ""} to bring this space to life.</p></section>}
          {totalPages > 1 && <nav aria-label="Community feed pages" className="flex items-center justify-center gap-3 rounded-[18px] border border-[#e0e7e2] bg-white p-3"><Link aria-disabled={currentPage <= 1} href={pageHref(Math.max(1, currentPage - 1))} className={`inline-flex h-9 items-center gap-1 rounded-xl border border-[#dce5df] px-3 text-xs font-semibold ${currentPage <= 1 ? "pointer-events-none opacity-40" : "hover:bg-[#f4f7f5]"}`}><ChevronLeft size={14}/> Previous</Link><span className="text-xs text-[#74827a]">Page <b>{Math.min(currentPage, totalPages)}</b> of <b>{totalPages}</b></span><Link aria-disabled={currentPage >= totalPages} href={pageHref(Math.min(totalPages, currentPage + 1))} className={`inline-flex h-9 items-center gap-1 rounded-xl border border-[#dce5df] px-3 text-xs font-semibold ${currentPage >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-[#f4f7f5]"}`}>Next <ChevronRight size={14}/></Link></nav>}
        </div>
        {(!activeSpace || activeSpace.show_right_sidebar) && <aside className="space-y-5">
          <section className="rounded-[22px] border border-[#e0e7e2] bg-white p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#397558]">Community people</p><h2 className="font-display mt-1 font-bold">New members</h2></div><Users size={17} className="text-[#397558]"/></div><div className="mt-4 space-y-3">{newMembers.map((member) => <div key={member.user_id} className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e7f2ec] text-[9px] font-bold text-[#286b50]">{initials(member.profile?.display_name || "Member")}</span><div className="min-w-0"><b className="block truncate text-xs">{member.profile?.display_name || "Member"}</b><span className="mt-0.5 block truncate text-[10px] text-[#7c8982]">{member.profile?.headline || "Community member"}</span>{member.profile?.location && <span className="mt-1 flex items-center gap-1 text-[9px] text-[#9aa49e]"><MapPin size={9}/>{member.profile.location}</span>}</div></div>)}{!newMembers.length && <p className="rounded-xl border border-dashed border-[#d6dfda] p-4 text-center text-xs text-[#819087]">The next introduction will appear here.</p>}</div></section>
          <section className="rounded-[22px] border border-[#e0e7e2] bg-white p-4"><h2 className="font-display font-bold">Getting started</h2><div className="mt-4 space-y-3">{[["Set up your profile", true], ["Introduce yourself", hasIntroduction], ["Welcome another member", false], ["Join an event", false]].map(([label, done]) => <div key={String(label)} className="flex items-center gap-2.5"><CheckCircle2 size={15} className={done ? "text-[#2d805c]" : "text-[#c3ccc7]"}/><span className={`text-xs ${done ? "font-semibold text-[#40584b]" : "text-[#87928c]"}`}>{String(label)}</span></div>)}</div><Link href="/community/introduce" className="mt-5 flex h-9 items-center justify-center rounded-xl bg-[#edf4f0] text-[10px] font-bold text-[#286b50]">{hasIntroduction ? "Edit my introduction" : "Start introduction"}</Link></section>
        </aside>}
      </div>
    </div>
  </main>;
}
