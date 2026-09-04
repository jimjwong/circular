import { createClient } from "@supabase/supabase-js";
import { signBadgeAward } from "../lib/badges/open-badge.ts";
import { createHash } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Supabase local environment variables are required.");

const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const password = "Demo123!";
const accountSpecs = [
  { key: "platform", email: "superadmin@circular.demo", name: "Sam Platform", role: null, headline: "Circular platform owner", score: 100 },
  { key: "owner", email: "owner@circular.demo", name: "Olivia Owner", role: "owner", headline: "Community founder", score: 94 },
  { key: "admin", email: "admin@circular.demo", name: "Aiden Admin", role: "admin", headline: "Community operations", score: 88 },
  { key: "moderator", email: "moderator@circular.demo", name: "Maya Moderator", role: "moderator", headline: "Community guide", score: 82 },
  { key: "member", email: "member@circular.demo", name: "Morgan Member", role: "member", headline: "Independent creator", score: 68 },
  { key: "student", email: "student@circular.demo", name: "Taylor Student", role: "member", headline: "Creator OS student", score: 53 },
];

const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
const accounts = {};
for (const spec of accountSpecs) {
  let user = listed.users.find(candidate=>candidate.email === spec.email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({ email: spec.email, password, email_confirm: true, user_metadata: { full_name: spec.name } });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true, user_metadata: { ...user.user_metadata, full_name: spec.name } });
    if (error) throw error;
    user = data.user;
  }
  accounts[spec.key] = user;
  const { error: profileError } = await supabase.from("profiles").upsert({ id: user.id, display_name: spec.name, email: spec.email, headline: spec.headline, bio: `${spec.headline}. I am here to learn, contribute, and meet thoughtful community builders.`, location: "Singapore", interests: ["community building", "creator business"], timezone: "Asia/Singapore", updated_at: new Date().toISOString() });
  if (profileError) throw profileError;
}

const { error: staffError } = await supabase.from("platform_staff").upsert({ user_id: accounts.platform.id, role: "super_admin", is_active: true, granted_by: accounts.platform.id });
if (staffError) throw staffError;

let { data: tenant, error: tenantReadError } = await supabase.from("tenants").select("id").eq("slug", "creator-collective-demo").maybeSingle();
if (tenantReadError) throw tenantReadError;
if (!tenant) {
  const result = await supabase.from("tenants").insert({ name: "Creator Collective Demo", slug: "creator-collective-demo", description: "A populated local workspace for demonstrating Circular community features.", plan: "pro", status: "active", created_by: accounts.owner.id, accent_color: "#176b4d" }).select("id").single();
  if (result.error) throw result.error;
  tenant = result.data;
} else {
  const { error } = await supabase.from("tenants").update({ name: "Creator Collective Demo", description: "A populated local workspace for demonstrating Circular community features.", plan: "pro", status: "active", updated_at: new Date().toISOString() }).eq("id", tenant.id);
  if (error) throw error;
}

for (const spec of accountSpecs.filter(spec=>spec.role)) {
  const { error } = await supabase.from("tenant_memberships").upsert({ tenant_id: tenant.id, user_id: accounts[spec.key].id, role: spec.role, headline: spec.headline, activity_score: spec.score, status: "active", invited_by: spec.key === "owner" ? null : accounts.owner.id, updated_at: new Date().toISOString() });
  if (error) throw error;
}
const { error: subscriptionError } = await supabase.from("tenant_subscriptions").upsert({ tenant_id: tenant.id, plan_id: "pro", status: "active", billing_provider: "local", updated_at: new Date().toISOString() });
if (subscriptionError) throw subscriptionError;

const spaceSpecs = [
  { slug: "announcements", name: "Announcements", description: "Important news and updates from the team.", kind: "discussion", icon: "megaphone", visibility: "members", position: 10 },
  { slug: "introductions", name: "Introductions", description: "Meet fellow members and share what you are building.", kind: "discussion", icon: "wave", visibility: "members", position: 20 },
  { slug: "creator-lounge", name: "Creator Lounge", description: "Casual conversation, questions, and daily wins.", kind: "chat", icon: "coffee", visibility: "members", position: 30 },
  { slug: "leadership-room", name: "Leadership Room", description: "Private planning for the workspace team.", kind: "discussion", icon: "lock", visibility: "private", position: 40 },
  { slug: "creator-os", name: "Creator OS", description: "Course discussions, exercises, and lesson resources.", kind: "course", icon: "graduation", visibility: "members", position: 50 },
];
const spaces = {};
for (const spec of spaceSpecs) {
  const { data, error } = await supabase.from("spaces").upsert({ tenant_id: tenant.id, ...spec }, { onConflict: "tenant_id,slug" }).select("id").single();
  if (error) throw error;
  spaces[spec.slug] = data;
}
const { error: privateGrantError } = await supabase.from("space_members").upsert({ tenant_id: tenant.id, space_id: spaces["leadership-room"].id, user_id: accounts.student.id, granted_by: accounts.owner.id });
if (privateGrantError) throw privateGrantError;
const { error: privateMemberCleanupError } = await supabase.from("space_members").delete().eq("space_id", spaces["leadership-room"].id).eq("user_id", accounts.member.id);
if (privateMemberCleanupError) throw privateMemberCleanupError;

const postSpecs = [
  { key: "welcome", space: "announcements", author: "owner", title: "Welcome to Creator Collective", text: "This demo community is populated with realistic roles and activity. Introduce yourself, explore the events, and continue the Creator OS course.", pinned: true, hoursAgo: 48 },
  { key: "intro", space: "introductions", author: "member", title: "What are you building this month?", text: "I am building a small membership program for independent designers. What is everyone else shipping?", pinned: false, hoursAgo: 22 },
  { key: "workflow", space: "creator-lounge", author: "moderator", title: "Share one workflow that saved you time", text: "My best improvement was turning every repeated support answer into a reusable community resource.", pinned: false, hoursAgo: 8 },
  { key: "planning", space: "leadership-room", author: "admin", title: "September community operating plan", text: "Priorities: improve onboarding, host two workshops, and review member activation every Friday.", pinned: true, hoursAgo: 4 },
  { key: "course", space: "creator-os", author: "admin", title: "Creator OS: start with the foundation lesson", text: "Complete the first lesson, write your one-sentence community promise, and share it in the comments.", pinned: true, hoursAgo: 2 },
  { key: "student-introduction", space: "introductions", author: "student", title: "👋 Hi, I'm Taylor Student", text: "I am learning how to turn useful knowledge into a welcoming community experience.\n\nWhat I hope to get from this community\nI would love feedback on my first member journey and to meet other course creators.", pinned: false, hoursAgo: 14 },
  { key: "moderator-introduction", space: "introductions", author: "moderator", title: "👋 Hi, I'm Maya Moderator", text: "I help community teams create safe, generous spaces where members feel comfortable contributing.\n\nWhat I hope to get from this community\nI want to exchange practical moderation and engagement systems with other community leaders.", pinned: false, hoursAgo: 36 },
];
const posts = {};
for (const spec of postSpecs) {
  let { data } = await supabase.from("posts").select("id").eq("tenant_id", tenant.id).eq("title", spec.title).maybeSingle();
  const values = { tenant_id: tenant.id, space_id: spaces[spec.space].id, author_id: accounts[spec.author].id, title: spec.title, body: { text: spec.text }, status: "published", is_pinned: spec.pinned, published_at: new Date(Date.now() - spec.hoursAgo * 3600000).toISOString(), updated_at: new Date().toISOString() };
  if (!data) {
    const result = await supabase.from("posts").insert(values).select("id").single();
    if (result.error) throw result.error;
    data = result.data;
  } else {
    const { error } = await supabase.from("posts").update(values).eq("id", data.id);
    if (error) throw error;
  }
  posts[spec.key] = data;
}

for (const [accountKey, postKey] of [["student", "student-introduction"], ["moderator", "moderator-introduction"]]) {
  const { error } = await supabase.from("member_onboarding").upsert({ tenant_id: tenant.id, user_id: accounts[accountKey].id, introduction_post_id: posts[postKey].id, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  if (error) throw error;
}
const { error: resetMemberOnboardingError } = await supabase.from("member_onboarding").delete().eq("tenant_id", tenant.id).eq("user_id", accounts.member.id);
if (resetMemberOnboardingError) throw resetMemberOnboardingError;

const commentSpecs = [
  { key: "intro-owner", post: "intro", author: "owner", body: "Love this direction. What would make the first ten members call it indispensable?" },
  { key: "intro-reply", post: "intro", author: "member", body: "A weekly critique circle with the same small peer group would do it.", parent: "intro-owner" },
  { key: "workflow-student", post: "workflow", author: "student", body: "A welcome checklist and automated reminder cut my onboarding questions in half." },
  { key: "course-member", post: "course", author: "member", body: "My promise: a calm place for designers to turn expertise into useful products." },
];
const comments = {};
for (const spec of commentSpecs) {
  let { data } = await supabase.from("comments").select("id").eq("post_id", posts[spec.post].id).eq("body", spec.body).maybeSingle();
  if (!data) {
    const result = await supabase.from("comments").insert({ tenant_id: tenant.id, post_id: posts[spec.post].id, author_id: accounts[spec.author].id, parent_id: spec.parent ? comments[spec.parent].id : null, body: spec.body }).select("id").single();
    if (result.error) throw result.error;
    data = result.data;
  }
  comments[spec.key] = data;
}

for (const [postKey, accountKey] of [["welcome", "admin"], ["welcome", "member"], ["intro", "owner"], ["intro", "student"], ["workflow", "member"], ["course", "student"]]) {
  const { error } = await supabase.from("reactions").upsert({ tenant_id: tenant.id, user_id: accounts[accountKey].id, post_id: posts[postKey].id, comment_id: null, emoji: "heart" }, { onConflict: "user_id,post_id,comment_id,emoji" });
  if (error) throw error;
}

const courseSpecs = [
  { key: "creator-os", slug: "creator-os", title: "Creator OS", description: "Build a clear offer, an engaged audience, and a repeatable community operating system.", status: "published", space: "creator-os", category: "Creator business", cpd: 6, access: "paid", price: 14900, navigation: "sequential", expiry: 24 },
  { key: "community-foundations", slug: "community-foundations", title: "Community Foundations", description: "A practical starter program for designing a useful, welcoming member journey.", status: "published", space: "creator-os", category: "Community leadership", cpd: 3, access: "free", price: 0, navigation: "free", expiry: null },
  { key: "speaker-mastery-lab", slug: "speaker-mastery-lab", title: "Speaker Mastery Lab", description: "A private cohort program for developing a compelling professional keynote.", status: "published", space: "creator-os", category: "Professional speaking", cpd: 8, access: "private", price: 0, navigation: "sequential", expiry: 12 },
];
const courses = {};
for (const spec of courseSpecs) {
  let { data } = await supabase.from("courses").select("id").eq("tenant_id", tenant.id).eq("slug", spec.slug).maybeSingle();
  if (!data) ({ data } = await supabase.from("courses").select("id").eq("tenant_id", tenant.id).eq("title", spec.title).maybeSingle());
  const values = { tenant_id: tenant.id, space_id: spaces[spec.space].id, title: spec.title, slug: spec.slug, description: spec.description, category: spec.category, cpd_hours_total: spec.cpd, price_cents: spec.price, currency: "SGD", access_mode: spec.access, navigation_mode: spec.navigation, completion_percent: 100, certificate_expiry_months: spec.expiry, status: spec.status, created_by: accounts.owner.id, updated_at: new Date().toISOString() };
  if (!data) {
    const result = await supabase.from("courses").insert(values).select("id").single();
    if (result.error) throw result.error;
    data = result.data;
  } else {
    const { error } = await supabase.from("courses").update(values).eq("id", data.id);
    if (error) throw error;
  }
  courses[spec.key] = data;
}

const lessonSpecs = [
  { course: "creator-os", title: "Define your community promise", text: "Write one sentence describing who the community serves and the transformation members will achieve.", position: 10, preview: true },
  { course: "creator-os", title: "Design the first member journey", text: "Map the first seven days from invitation to a meaningful contribution.", position: 20, preview: false },
  { course: "creator-os", title: "Create a sustainable weekly rhythm", text: "Choose the recurring conversations, events, and resources that produce member value.", position: 30, preview: false },
  { course: "community-foundations", title: "Choose a focused audience", text: "Describe the smallest group with a shared challenge you can serve exceptionally well.", position: 10, preview: true },
  { course: "community-foundations", title: "Measure meaningful participation", text: "Define the actions that show members are receiving and creating value.", position: 20, preview: false },
];
const lessons = [];
for (const spec of lessonSpecs) {
  let { data } = await supabase.from("course_lessons").select("id").eq("course_id", courses[spec.course].id).eq("title", spec.title).maybeSingle();
  if (!data) {
    const result = await supabase.from("course_lessons").insert({ tenant_id: tenant.id, course_id: courses[spec.course].id, title: spec.title, body: { text: spec.text }, position: spec.position, is_preview: spec.preview }).select("id").single();
    if (result.error) throw result.error;
    data = result.data;
  }
  lessons.push(data);
}
for (let index = 0; index < lessons.length; index += 1) {
  const percent = index < 2 ? 100 : index === 2 ? 40 : 0;
  const { error } = await supabase.from("course_progress").upsert({ tenant_id: tenant.id, lesson_id: lessons[index].id, user_id: accounts.student.id, percent, completed_at: percent === 100 ? new Date().toISOString() : null });
  if (error) throw error;
}

const stableUuid = (value) => { const hash = createHash("sha256").update(value).digest("hex"); return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`; };
const moduleSpecs = [
  { key: "creator-foundation", course: "creator-os", title: "1. Clarify the foundation", description: "Define the member, promise, and first meaningful outcome.", position: 10, unlock: "none" },
  { key: "creator-rhythm", course: "creator-os", title: "2. Build the operating rhythm", description: "Turn the promise into a sustainable weekly system.", position: 20, unlock: "previous_module_complete" },
  { key: "community-welcome", course: "community-foundations", title: "1. Design a welcoming start", description: "Make the first seven days clear and valuable.", position: 10, unlock: "none" },
  { key: "community-engagement", course: "community-foundations", title: "2. Measure meaningful engagement", description: "Track participation that signals real member value.", position: 20, unlock: "none" },
  { key: "speaker-story", course: "speaker-mastery-lab", title: "1. Shape your signature story", description: "Build a memorable narrative around a useful idea.", position: 10, unlock: "none" },
  { key: "speaker-stage", course: "speaker-mastery-lab", title: "2. Rehearse for the stage", description: "Practice delivery, timing, and audience connection.", position: 20, unlock: "previous_module_complete" },
];
const courseModules = {};
for (const spec of moduleSpecs) {
  let { data } = await supabase.from("course_modules").select("id").eq("course_id", courses[spec.course].id).eq("title", spec.title).maybeSingle();
  const values = { tenant_id: tenant.id, course_id: courses[spec.course].id, title: spec.title, description: spec.description, position: spec.position, unlock_requirement: spec.unlock, unlock_at: null, updated_at: new Date().toISOString() };
  if (!data) { const result = await supabase.from("course_modules").insert(values).select("id").single(); if (result.error) throw result.error; data = result.data; }
  else { const { error } = await supabase.from("course_modules").update(values).eq("id", data.id); if (error) throw error; }
  courseModules[spec.key] = data;
}

const itemSpecs = [
  { key: "creator-welcome", course: "creator-os", module: "creator-foundation", title: "Welcome to Creator OS", type: "video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", text: "Start here: understand the learning journey and the project you will complete.", minutes: 8, position: 10, rule: "manual_mark_complete", preview: true },
  { key: "creator-promise", course: "creator-os", module: "creator-foundation", title: "Write your community promise", type: "reading", text: "Define who your community serves, the change members seek, and why your approach is distinct.", minutes: 18, position: 20, rule: "manual_mark_complete" },
  { key: "creator-check", course: "creator-os", module: "creator-foundation", title: "Foundation knowledge check", type: "quiz", text: "Which statement is the strongest community promise?", options: ["A place for everyone to network", "A weekly critique circle helping independent designers ship stronger client work", "A community with lots of useful content"], correct: "A weekly critique circle helping independent designers ship stronger client work", minutes: 10, position: 30, rule: "score_threshold", score: 80 },
  { key: "creator-rhythm-plan", course: "creator-os", module: "creator-rhythm", title: "Submit your weekly rhythm", type: "assignment", text: "Share a link to your weekly community operating plan.", minutes: 35, position: 10, rule: "must_submit" },
  { key: "creator-resource", course: "creator-os", module: "creator-rhythm", title: "Community operating canvas", type: "external_link", url: "https://www.apss.org.sg/", text: "Use this reference while refining your operating system.", minutes: 12, position: 20, rule: "manual_mark_complete" },
  { key: "community-audience", course: "community-foundations", module: "community-welcome", title: "Choose a focused audience", type: "reading", text: "Describe the smallest group with a shared challenge you can serve exceptionally well.", minutes: 20, position: 10, rule: "manual_mark_complete", preview: true },
  { key: "community-first-week", course: "community-foundations", module: "community-welcome", title: "Map the first member week", type: "assignment", text: "Submit a link to your seven-day onboarding map.", minutes: 30, position: 20, rule: "must_submit" },
  { key: "community-metrics", course: "community-foundations", module: "community-engagement", title: "Meaningful participation metrics", type: "reading", text: "Select contribution, connection, and outcome signals that reflect member value.", minutes: 25, position: 10, rule: "manual_mark_complete" },
  { key: "speaker-story-map", course: "speaker-mastery-lab", module: "speaker-story", title: "Signature story map", type: "assignment", text: "Submit the story arc for your keynote opening.", minutes: 45, position: 10, rule: "must_submit", preview: true },
  { key: "speaker-rehearsal", course: "speaker-mastery-lab", module: "speaker-stage", title: "Recorded rehearsal", type: "video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", text: "Review the rehearsal and record your completion after watching at least 90%.", minutes: 30, position: 10, rule: "manual_mark_complete" },
];
const moduleItems = {};
for (const spec of itemSpecs) {
  let { data } = await supabase.from("module_items").select("id").eq("module_id", courseModules[spec.module].id).eq("title", spec.title).maybeSingle();
  const values = { tenant_id: tenant.id, course_id: courses[spec.course].id, module_id: courseModules[spec.module].id, item_type: spec.type, title: spec.title, content_url: spec.url ?? null, content_body: { text: spec.text, options: spec.options ?? [], correctAnswer: spec.correct ?? "" }, estimated_minutes: spec.minutes, position: spec.position, completion_requirement: spec.rule, score_threshold: spec.score ?? null, watch_threshold: 90, is_required: true, is_preview: spec.preview ?? false, updated_at: new Date().toISOString() };
  if (!data) { const result = await supabase.from("module_items").insert(values).select("id").single(); if (result.error) throw result.error; data = result.data; }
  else { const { error } = await supabase.from("module_items").update(values).eq("id", data.id); if (error) throw error; }
  moduleItems[spec.key] = data;
}

await supabase.from("course_instructors").upsert({ tenant_id: tenant.id, course_id: courses["creator-os"].id, user_id: accounts.admin.id, assigned_by: accounts.owner.id }, { onConflict: "course_id,user_id" });
async function seedEnrollment(accountKey, courseKey, state, completedItemKeys, activeItemKey) {
  const { data: enrollment, error } = await supabase.from("course_enrollments").upsert({ tenant_id: tenant.id, course_id: courses[courseKey].id, user_id: accounts[accountKey].id, status: "active", enrolled_at: new Date(Date.now() - 14 * 86400000).toISOString(), last_accessed_at: new Date(Date.now() - 2 * 3600000).toISOString(), completed_at: null, dropped_at: null }, { onConflict: "course_id,user_id" }).select("id").single();
  if (error) throw error;
  for (const itemKey of completedItemKeys) {
    const item = moduleItems[itemKey];
    const { error: progressError } = await supabase.from("course_item_progress").upsert({ tenant_id: tenant.id, enrollment_id: enrollment.id, module_item_id: item.id, user_id: accounts[accountKey].id, status: "in_progress", time_spent_seconds: 900, first_accessed_at: new Date(Date.now() - 7 * 86400000).toISOString(), last_accessed_at: new Date().toISOString(), completed_at: null }, { onConflict: "enrollment_id,module_item_id" });
    if (progressError) throw progressError;
    const completionValues = { status: "complete", completed_at: new Date().toISOString(), submission_url: itemKey.includes("week") ? "https://example.com/demo-submission" : null, score: itemKey.includes("check") ? 92 : null, watch_percent: itemKey.includes("welcome") ? 100 : 0 };
    const { error: completionError } = await supabase.from("course_item_progress").update(completionValues).eq("enrollment_id", enrollment.id).eq("module_item_id", item.id);
    if (completionError) throw completionError;
    const heartbeatKey = stableUuid(`${tenant.id}:${accountKey}:${itemKey}:heartbeat`);
    const { error: ledgerError } = await supabase.from("learning_hours_ledger").upsert({ tenant_id: tenant.id, user_id: accounts[accountKey].id, enrollment_id: enrollment.id, module_item_id: item.id, seconds_logged: 60, session_key: stableUuid(`${tenant.id}:${accountKey}:${itemKey}:session`), heartbeat_key: heartbeatKey }, { onConflict: "heartbeat_key" });
    if (ledgerError) throw ledgerError;
  }
  if (activeItemKey) {
    const { error: activeError } = await supabase.from("course_item_progress").upsert({ tenant_id: tenant.id, enrollment_id: enrollment.id, module_item_id: moduleItems[activeItemKey].id, user_id: accounts[accountKey].id, status: "in_progress", time_spent_seconds: 420, first_accessed_at: new Date().toISOString(), last_accessed_at: new Date().toISOString() }, { onConflict: "enrollment_id,module_item_id" });
    if (activeError) throw activeError;
  }
  if (state === "dropped") { const { error: dropError } = await supabase.from("course_enrollments").update({ status: "dropped", dropped_at: new Date().toISOString() }).eq("id", enrollment.id); if (dropError) throw dropError; }
  return enrollment;
}
await seedEnrollment("student", "creator-os", "active", ["creator-welcome", "creator-promise"], "creator-check");
await seedEnrollment("member", "creator-os", "dropped", ["creator-welcome"], null);
await seedEnrollment("student", "speaker-mastery-lab", "active", [], "speaker-story-map");
await seedEnrollment("moderator", "community-foundations", "completed", ["community-audience", "community-first-week", "community-metrics"], null);
await supabase.from("course_payments").upsert({ tenant_id: tenant.id, course_id: courses["creator-os"].id, user_id: accounts.student.id, amount_cents: 14900, currency: "SGD", provider: "dummy", provider_reference: "demo_creator_os_student", status: "succeeded" }, { onConflict: "provider,provider_reference" });
const { data: completedAward } = await supabase.from("course_badge_awards").select("id").eq("course_id", courses["community-foundations"].id).eq("user_id", accounts.moderator.id).maybeSingle();
if (completedAward) await signBadgeAward(supabase, completedAward.id);

let { data: demoEvent } = await supabase.from("events").select("id").eq("tenant_id", tenant.id).eq("title", "Creator clarity workshop").maybeSingle();
if (!demoEvent) {
  const result = await supabase.from("events").insert({ tenant_id: tenant.id, space_id: spaces["creator-os"].id, host_id: accounts.admin.id, title: "Creator clarity workshop", description: "A practical workshop for sharpening your community promise and first offer.", starts_at: new Date(Date.now() + 3 * 86400000).toISOString(), ends_at: new Date(Date.now() + 3 * 86400000 + 5400000).toISOString(), location_type: "live_room", capacity: 50, status: "scheduled" }).select("id").single();
  if (result.error) throw result.error;
  demoEvent = result.data;
}
for (const attendee of [accounts.member, accounts.student, accounts.moderator]) {
  const { error } = await supabase.from("event_rsvps").upsert({ tenant_id: tenant.id, event_id: demoEvent.id, user_id: attendee.id, status: "going" });
  if (error) throw error;
}

console.log(JSON.stringify({ workspace: "Creator Collective Demo", slug: "creator-collective-demo", password, accounts: accountSpecs.map(({ key, email, name, role })=>({ key, email, name, role: role ?? "super_admin" })), spaces: spaceSpecs.length + 1, courses: courseSpecs.length, legacyLessons: lessonSpecs.length, lmsModules: moduleSpecs.length, lmsItems: itemSpecs.length, signedBadgeDemo: true }, null, 2));
