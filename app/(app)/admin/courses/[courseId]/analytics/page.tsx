import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft, BarChart3, CheckCircle2, Clock3, UserPlus, Users } from "lucide-react";
import { enrollLearnerByEmail, setLearnerEnrollmentStatus } from "@/app/actions/courses";
import { SubmitButton } from "@/components/community/submit-button";
import { getActiveOrganization, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export default async function CourseAnalyticsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) notFound();
  const supabase = await createClient();
  const [{ data: course }, { data: instructor }] = await Promise.all([
    supabase.from("courses").select("id, title, slug, completion_percent").eq("id", courseId).eq("tenant_id", organization.id).maybeSingle(),
    supabase.from("course_instructors").select("user_id").eq("course_id", courseId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!course || (!["owner", "admin"].includes(organization.role) && !instructor)) notFound();
  const [{ data: enrollments }, { data: items }, { data: modules }] = await Promise.all([
    supabase.from("course_enrollments").select("id, user_id, status, enrolled_at, last_accessed_at, completed_at, dropped_at").eq("course_id", course.id).order("enrolled_at", { ascending: false }),
    supabase.from("module_items").select("id, module_id, title, position, is_required").eq("course_id", course.id),
    supabase.from("course_modules").select("id, title, position").eq("course_id", course.id).order("position"),
  ]);
  const enrollmentIds = (enrollments ?? []).map((row) => row.id);
  const userIds = (enrollments ?? []).map((row) => row.user_id);
  const [{ data: progress }, { data: profiles }] = await Promise.all([
    enrollmentIds.length ? supabase.from("course_item_progress").select("enrollment_id, module_item_id, status, time_spent_seconds, last_accessed_at").in("enrollment_id", enrollmentIds) : Promise.resolve({ data: [] }),
    userIds.length ? supabase.from("profiles").select("id, display_name, email").in("id", userIds) : Promise.resolve({ data: [] }),
  ]);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const requiredItems = (items ?? []).filter((item) => item.is_required);
  const learnerRows = (enrollments ?? []).map((enrollment) => {
    const learnerProgress = (progress ?? []).filter((row) => row.enrollment_id === enrollment.id);
    const completed = learnerProgress.filter((row) => row.status === "complete" && requiredItems.some((item) => item.id === row.module_item_id)).length;
    const percent = requiredItems.length ? Math.floor((completed / requiredItems.length) * 100) : 0;
    const seconds = learnerProgress.reduce((sum, row) => sum + row.time_spent_seconds, 0);
    const latest = [...learnerProgress].sort((a, b) => (b.last_accessed_at ?? "").localeCompare(a.last_accessed_at ?? ""))[0];
    return { enrollment, profile: profileMap.get(enrollment.user_id), completed, percent, seconds, latestItemId: latest?.module_item_id };
  });
  const completionRate = learnerRows.length ? Math.round((learnerRows.filter((row) => row.enrollment.status === "completed").length / learnerRows.length) * 100) : 0;
  const completedDurations = learnerRows.filter((row) => row.enrollment.completed_at).map((row) => (new Date(row.enrollment.completed_at!).getTime() - new Date(row.enrollment.enrolled_at).getTime()) / 86_400_000);
  const averageDays = completedDurations.length ? completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length : 0;
  const dropOff = (modules ?? []).map((module) => { const moduleItems = (items ?? []).filter((item) => item.module_id === module.id); const latestCount = learnerRows.filter((row) => moduleItems.some((item) => item.id === row.latestItemId) && row.enrollment.status !== "completed").length; const completedCount = learnerRows.filter((row) => moduleItems.filter((item) => item.is_required).every((item) => (progress ?? []).some((entry) => entry.enrollment_id === row.enrollment.id && entry.module_item_id === item.id && entry.status === "complete"))).length; return { ...module, latestCount, completedCount }; });

  return <main className="min-h-screen bg-[#f5f7f5] p-4 text-[#18251f] sm:p-8"><div className="mx-auto max-w-6xl space-y-6"><header className="flex items-center gap-3"><Link href={`/admin/courses/${course.id}`} className="grid size-10 place-items-center rounded-xl border border-[#dce5df] bg-white"><ArrowLeft size={16}/></Link><span className="grid size-10 place-items-center rounded-xl bg-[#183f30] text-white"><BarChart3 size={18}/></span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#397558]">Course analytics</p><h1 className="font-display text-xl font-bold">{course.title}</h1></div></header>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={Users} label="Enrollments" value={String(learnerRows.length)}/><Metric icon={CheckCircle2} label="Completion rate" value={`${completionRate}%`}/><Metric icon={Clock3} label="Average completion" value={`${averageDays.toFixed(1)} days`}/><Metric icon={Activity} label="Dropped" value={String(learnerRows.filter((row) => row.enrollment.status === "dropped").length)}/></section>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><section className="overflow-hidden rounded-[22px] border border-[#e0e7e2] bg-white"><div className="border-b border-[#edf1ee] p-5"><h2 className="font-display font-bold">Learner progress</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-[#f7f9f7] text-[9px] uppercase text-[#718078]"><tr><th className="px-5 py-3">Learner</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Progress</th><th className="px-5 py-3">Time</th><th className="px-5 py-3"></th></tr></thead><tbody className="divide-y divide-[#edf1ee]">{learnerRows.map((row) => <tr key={row.enrollment.id}><td className="px-5 py-3"><b className="block text-xs">{row.profile?.display_name ?? "Learner"}</b><span className="text-[9px] text-[#7b8981]">{row.profile?.email}</span></td><td className="px-5 py-3 text-xs capitalize">{row.enrollment.status}</td><td className="px-5 py-3"><span className="text-xs font-bold">{row.percent}%</span><div className="mt-1 h-1.5 w-24 rounded-full bg-[#e7ede9]"><div className="h-full rounded-full bg-[#3b8967]" style={{ width: `${row.percent}%` }}/></div></td><td className="px-5 py-3 text-xs">{(row.seconds / 60).toFixed(0)}m</td><td className="px-5 py-3"><form action={setLearnerEnrollmentStatus}><input type="hidden" name="courseId" value={course.id}/><input type="hidden" name="enrollmentId" value={row.enrollment.id}/><input type="hidden" name="status" value={row.enrollment.status === "dropped" ? "active" : "dropped"}/><button className="text-[10px] font-bold text-[#397258]">{row.enrollment.status === "dropped" ? "Reactivate" : "Mark dropped"}</button></form></td></tr>)}</tbody></table></div></section><aside className="space-y-5"><section className="rounded-[22px] border border-[#e0e7e2] bg-white p-5"><div className="flex items-center gap-2"><UserPlus size={15} className="text-[#397258]"/><h2 className="font-display font-bold">Enroll learner</h2></div><form action={enrollLearnerByEmail} className="mt-4 space-y-2"><input type="hidden" name="courseId" value={course.id}/><input type="email" name="email" required placeholder="member@example.com" className="h-10 w-full rounded-xl border border-[#dce5df] px-3 text-xs"/><SubmitButton className="h-10 w-full rounded-xl bg-[#183f30] text-xs font-bold text-white">Add enrollment</SubmitButton></form></section><section className="rounded-[22px] border border-[#e0e7e2] bg-white p-5"><h2 className="font-display font-bold">Module drop-off</h2><div className="mt-4 space-y-4">{dropOff.map((module) => <div key={module.id}><div className="flex justify-between text-xs"><span className="font-semibold">{module.title}</span><span className="text-[#718078]">{module.completedCount} completed</span></div><p className="mt-1 text-[9px] text-[#8a968f]">{module.latestCount} learners last active here</p></div>)}</div></section></aside></div>
  </div></main>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) { return <div className="rounded-[20px] border border-[#e0e7e2] bg-white p-5"><Icon size={18} className="text-[#397258]"/><strong className="font-display mt-4 block text-2xl">{value}</strong><span className="text-xs text-[#718078]">{label}</span></div>; }
