import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ExternalLink, FileQuestion, GraduationCap, LockKeyhole, Menu, PlayCircle } from "lucide-react";
import { LearningControls } from "@/components/courses/learning-controls";
import { getActiveOrganization, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

function bodyText(body: unknown) {
  return body && typeof body === "object" && "text" in body && typeof body.text === "string" ? body.text : "";
}

function quizChoices(body: unknown) {
  if (!body || typeof body !== "object" || !("options" in body) || !Array.isArray(body.options)) return [];
  return body.options.filter((value): value is string => typeof value === "string");
}

function embedUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.hostname === "youtu.be") return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
    if (url.hostname.endsWith("youtube.com")) {
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    return value;
  } catch { return null; }
}

export default async function CoursePlayerPage({ params }: { params: Promise<{ courseSlug: string; itemId: string }> }) {
  const { courseSlug, itemId } = await params;
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) redirect("/onboarding");
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, title, slug, navigation_mode, status").eq("tenant_id", organization.id).eq("slug", courseSlug).maybeSingle();
  if (!course) notFound();
  const [{ data: modules }, { data: rawItems }, { data: enrollment }, { data: instructor }, { data: canOpen }] = await Promise.all([
    supabase.from("course_modules").select("id, title, position, unlock_requirement, unlock_at").eq("course_id", course.id).order("position"),
    supabase.from("module_items").select("id, module_id, title, item_type, content_url, content_body, estimated_minutes, position, completion_requirement, score_threshold, watch_threshold, is_required, is_preview").eq("course_id", course.id),
    supabase.from("course_enrollments").select("id, status").eq("course_id", course.id).eq("user_id", user.id).maybeSingle(),
    supabase.from("course_instructors").select("user_id").eq("course_id", course.id).eq("user_id", user.id).maybeSingle(),
    supabase.rpc("lms_can_open_course_item", { check_item_id: itemId }),
  ]);
  if (!canOpen) redirect(`/courses/${course.slug}`);
  const modulePosition = new Map((modules ?? []).map((module) => [module.id, module.position]));
  const items = [...(rawItems ?? [])].sort((a, b) => (modulePosition.get(a.module_id) ?? 0) - (modulePosition.get(b.module_id) ?? 0) || a.position - b.position || a.id.localeCompare(b.id));
  const item = items.find((row) => row.id === itemId);
  if (!item) notFound();
  const { data: progressRows } = enrollment ? await supabase.from("course_item_progress").select("module_item_id, status, time_spent_seconds").eq("enrollment_id", enrollment.id) : { data: [] };
  const completedIds = new Set((progressRows ?? []).filter((row) => row.status === "complete").map((row) => row.module_item_id));
  const currentProgress = (progressRows ?? []).find((row) => row.module_item_id === item.id);
  const canManage = ["owner", "admin"].includes(organization.role) || Boolean(instructor);
  const firstIncompleteIndex = items.findIndex((row) => row.is_required && !completedIds.has(row.id));
  const sequentialLimit = firstIncompleteIndex === -1 ? items.length : firstIncompleteIndex;
  const currentIndex = items.findIndex((row) => row.id === item.id);
  const previousItem = currentIndex > 0 ? items[currentIndex - 1] : null;
  const nextItem = currentIndex < items.length - 1 ? items[currentIndex + 1] : null;
  const currentModule = modules?.find((module) => module.id === item.module_id);
  const content = bodyText(item.content_body);
  const mediaUrl = embedUrl(item.content_url);
  const isExternal = ["external_link", "scorm"].includes(item.item_type);
  const isLocked = (row: typeof item, index: number) => {
    if (canManage || row.is_preview) return false;
    if (!enrollment) return true;
    const rowModule = modules?.find((module) => module.id === row.module_id);
    if (rowModule?.unlock_requirement === "date" && rowModule.unlock_at && new Date(rowModule.unlock_at) > new Date()) return true;
    if (rowModule?.unlock_requirement === "previous_module_complete") {
      const priorRequired = items.filter((candidate) => (modulePosition.get(candidate.module_id) ?? 0) < rowModule.position && candidate.is_required);
      if (priorRequired.some((candidate) => !completedIds.has(candidate.id))) return true;
    }
    return course.navigation_mode === "sequential" && index > sequentialLimit;
  };

  return <main className="min-h-screen bg-[#f5f7f5] text-[#18251f]">
    <header className="sticky top-0 z-20 border-b border-[#e0e7e2] bg-white/95 px-4 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3"><Link href={`/courses/${course.slug}`} className="grid size-9 place-items-center rounded-xl border border-[#dce5df]"><ArrowLeft size={15}/></Link><span className="grid size-9 place-items-center rounded-xl bg-[#183f30] text-white"><GraduationCap size={16}/></span><div className="min-w-0"><b className="font-display block truncate text-sm">{course.title}</b><span className="block truncate text-[10px] text-[#829087]">{currentModule?.title}</span></div><span className="ml-auto hidden rounded-full bg-[#edf3ef] px-3 py-1.5 text-[10px] font-bold capitalize text-[#4c705e] sm:block">{item.item_type.replaceAll("_", " ")}</span></div></header>
    <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 p-4 sm:p-8"><div className="mx-auto max-w-4xl">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f2ec] text-[#286b50]">{item.item_type === "video" ? <PlayCircle size={18}/> : item.item_type === "quiz" ? <FileQuestion size={18}/> : <BookOpen size={18}/>}</span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#397558]">Lesson {currentIndex + 1} of {items.length}</p><h1 className="font-display mt-1 text-2xl font-bold">{item.title}</h1><p className="mt-2 flex items-center gap-1 text-xs text-[#7b8981]"><Clock3 size={13}/>{item.estimated_minutes} minutes · {item.completion_requirement.replaceAll("_", " ")}</p></div></div>
        {item.item_type === "video" && mediaUrl && <div className="mt-7 aspect-video overflow-hidden rounded-[22px] bg-black"><iframe src={mediaUrl} title={item.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="size-full border-0"/></div>}
        {isExternal && mediaUrl && <section className="mt-7 rounded-[22px] border border-[#dce5df] bg-white p-7 text-center"><ExternalLink className="mx-auto text-[#397258]"/><h2 className="font-display mt-4 font-bold">Open this {item.item_type === "scorm" ? "SCORM activity" : "resource"}</h2><p className="mt-2 text-sm text-[#75837b]">This learning item is hosted externally and opens in a new tab.</p><a href={mediaUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#183f30] px-4 text-xs font-bold text-white">Launch activity <ExternalLink size={13}/></a></section>}
        {item.item_type === "quiz" ? <section className="mt-7 rounded-[22px] border border-[#e0e7e2] bg-white p-6"><FileQuestion className="text-[#397258]"/><h2 className="font-display mt-4 text-lg font-bold">Knowledge check</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#586b60]">{content || "Complete the assessment, then record the score below."}</p></section> : content && <article className="mt-7 rounded-[22px] border border-[#e0e7e2] bg-white p-6 sm:p-8"><div className="whitespace-pre-wrap text-sm leading-7 text-[#4f6257]">{content}</div></article>}
        {!content && !mediaUrl && <section className="mt-7 rounded-[22px] border border-dashed border-[#ccd9d1] bg-white p-10 text-center"><BookOpen className="mx-auto text-[#56816c]"/><h2 className="font-display mt-3 font-bold">Content is being prepared</h2></section>}
        {enrollment && <LearningControls itemId={item.id} itemType={item.item_type} completionRequirement={item.completion_requirement} watchThreshold={item.watch_threshold} scoreThreshold={item.score_threshold === null ? null : Number(item.score_threshold)} quizOptions={quizChoices(item.content_body)} completed={currentProgress?.status === "complete"} nextHref={nextItem && !isLocked(nextItem, currentIndex + 1) ? `/learn/${course.slug}/${nextItem.id}` : null}/>} 
        <nav className="mt-6 flex items-center justify-between gap-3">{previousItem ? <Link href={`/learn/${course.slug}/${previousItem.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#dce5df] bg-white px-4 text-xs font-bold"><ChevronLeft size={14}/> Previous</Link> : <span/>}{nextItem && !isLocked(nextItem, currentIndex + 1) ? <Link href={`/learn/${course.slug}/${nextItem.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#183f30] px-4 text-xs font-bold text-white">Next <ChevronRight size={14}/></Link> : nextItem ? <span className="inline-flex items-center gap-2 text-xs font-bold text-[#8a968f]"><LockKeyhole size={14}/> Complete this lesson to continue</span> : <span className="inline-flex items-center gap-2 text-xs font-bold text-[#397258]"><CheckCircle2 size={15}/> Final item</span>}</nav>
      </div></section>
      <aside className="border-l border-[#e0e7e2] bg-white p-4 lg:min-h-[calc(100vh-64px)]"><div className="flex items-center gap-2 px-2 py-3"><Menu size={15} className="text-[#397258]"/><h2 className="font-display font-bold">Course outline</h2></div><div className="mt-2 space-y-4">{(modules ?? []).map((module) => <section key={module.id}><h3 className="px-2 text-[10px] font-bold uppercase tracking-[.1em] text-[#607168]">{module.title}</h3><div className="mt-2 space-y-1">{items.filter((row) => row.module_id === module.id).map((row) => { const index = items.findIndex((candidate) => candidate.id === row.id); const selected = row.id === item.id; const locked = isLocked(row, index); return locked ? <div key={row.id} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-[#9aa49e]"><LockKeyhole size={13}/><span className="truncate">{row.title}</span></div> : <Link key={row.id} href={`/learn/${course.slug}/${row.id}`} aria-current={selected ? "page" : undefined} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${selected ? "bg-[#e8f2ec] text-[#246749]" : "text-[#607168] hover:bg-[#f4f7f5]"}`}>{completedIds.has(row.id) ? <CheckCircle2 size={14} className="text-[#2e7959]"/> : <span className={`size-2 rounded-full ${selected ? "bg-[#2e7959]" : "bg-[#ccd5d0]"}`}/>}<span className="truncate">{row.title}</span></Link>; })}</div></section>)}</div></aside>
    </div>
  </main>;
}
