import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase environment variables are required.");
const password = "Demo123!";
const specs = [
  ["owner", "owner@circular.demo", "owner"],
  ["admin", "admin@circular.demo", "admin"],
  ["moderator", "moderator@circular.demo", "moderator"],
  ["member", "member@circular.demo", "member"],
  ["student", "student@circular.demo", "member"],
];
const sessions = {};
const userIds = {};
for (const [keyName, email] of specs) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email} login failed: ${error.message}`);
  sessions[keyName] = client;
}
const { data: tenant, error: tenantError } = await sessions.owner.from("tenants").select("id").eq("slug", "creator-collective-demo").single();
if (tenantError) throw tenantError;

for (const [keyName, , role] of specs) {
  const { data: signedIn } = await sessions[keyName].auth.getUser();
  userIds[keyName] = signedIn.user.id;
  const { data: membership, error } = await sessions[keyName].from("tenant_memberships").select("role").eq("tenant_id", tenant.id).eq("user_id", signedIn.user.id).maybeSingle();
  if (error || membership?.role !== role) throw new Error(`${keyName} (${signedIn.user?.email ?? "no session"}, ${signedIn.user?.id ?? "no id"}) membership is incorrect for tenant ${tenant.id}: ${error?.message ?? membership?.role ?? "missing"}.`);
}
const [{ count: ownerSpaces }, { data: memberPrivate }, { data: studentPrivate }, { count: postCount }, { count: courseCount }, { count: lessonCount }, { count: progressCount }, { count: eventCount }, { count: completedIntroductions }, { data: memberOnboarding }] = await Promise.all([
  sessions.owner.from("spaces").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
  sessions.member.from("spaces").select("id").eq("tenant_id", tenant.id).eq("slug", "leadership-room").maybeSingle(),
  sessions.student.from("spaces").select("id").eq("tenant_id", tenant.id).eq("slug", "leadership-room").maybeSingle(),
  sessions.member.from("posts").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
  sessions.member.from("courses").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("status", "published"),
  sessions.member.from("course_lessons").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
  sessions.student.from("course_progress").select("lesson_id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
  sessions.member.from("events").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("status", "scheduled"),
  sessions.member.from("member_onboarding").select("user_id", { count: "exact", head: true }).eq("tenant_id", tenant.id).not("completed_at", "is", null),
  sessions.member.from("member_onboarding").select("user_id").eq("tenant_id", tenant.id).eq("user_id", userIds.member).maybeSingle(),
]);
if ((ownerSpaces ?? 0) < 6 || memberPrivate || !studentPrivate || (postCount ?? 0) < 6 || courseCount !== 2 || lessonCount !== 5 || progressCount !== 5 || !eventCount || (completedIntroductions ?? 0) < 2 || memberOnboarding) {
  throw new Error(`Demo content is incomplete: ${JSON.stringify({ ownerSpaces, memberPrivate: Boolean(memberPrivate), studentPrivate: Boolean(studentPrivate), postCount, courseCount, lessonCount, progressCount, eventCount, completedIntroductions, memberReadyForOnboarding: !memberOnboarding })}`);
}

const platform = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: platformLogin } = await platform.auth.signInWithPassword({ email: "superadmin@circular.demo", password });
if (platformLogin) throw platformLogin;
const { data: staff } = await platform.from("platform_staff").select("role").single();
if (staff?.role !== "super_admin") throw new Error("Demo platform account is not a super administrator.");

console.log(JSON.stringify({ demoLoginsVerified: 6, workspaceRolesVerified: true, publicCommunityContentVerified: true, privateSpaceDifferenceVerified: true, coursesAndProgressVerified: true, upcomingEventVerified: true, memberIntroductionJourneyVerified: true }, null, 2));
