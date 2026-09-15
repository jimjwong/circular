import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Local Supabase environment is required.");

async function session(email) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: "Demo123!" });
  if (error) throw error;
  return client;
}

const [admin, moderator, associate, professional, guest] = await Promise.all([
  session("admin@commune.demo"),
  session("moderator@commune.demo"),
  session("member@commune.demo"),
  session("student@commune.demo"),
  session("guest@commune.demo"),
]);

const { data: membership } = await admin.from("tenant_memberships").select("tenant_id").limit(1).single();
if (!membership) throw new Error("Demo tenant not found.");
const tenantId = membership.tenant_id;

const [{ data: guestSpaces, error: guestSpaceError }, { data: guestCourses, error: guestCourseError }] = await Promise.all([
  guest.from("spaces").select("slug").eq("tenant_id", tenantId).eq("status", "published"),
  guest.from("courses").select("slug").eq("tenant_id", tenantId).eq("status", "published"),
]);
if (guestSpaceError) throw guestSpaceError;
if (guestCourseError) throw guestCourseError;
if (guestSpaces?.length !== 1 || guestSpaces[0].slug !== "open-house") throw new Error(`Guest space access is incorrect: ${JSON.stringify(guestSpaces)}`);
if (guestCourses?.length) throw new Error(`Guests should not see demo courses: ${JSON.stringify(guestCourses)}`);

const { data: associateCourses, error: associateError } = await associate.from("courses").select("slug").eq("tenant_id", tenantId).eq("status", "published");
if (associateError) throw associateError;
if (!associateCourses?.some(course => course.slug === "community-foundations") || associateCourses.some(course => course.slug === "creator-os")) {
  throw new Error(`AM course access is incorrect: ${JSON.stringify(associateCourses)}`);
}

const { data: professionalCourses, error: professionalError } = await professional.from("courses").select("slug").eq("tenant_id", tenantId).eq("status", "published");
if (professionalError) throw professionalError;
for (const slug of ["community-foundations", "creator-os"]) {
  if (!professionalCourses?.some(course => course.slug === slug)) throw new Error(`PM cannot access ${slug}.`);
}

const { data: moderatorFullAccess, error: permissionError } = await moderator.rpc("has_tenant_permission", { check_tenant_id: tenantId, check_permission: "workspace.full_access" });
if (permissionError) throw permissionError;
if (!moderatorFullAccess) throw new Error("Moderator full access is not active.");

const { data: roles, error: roleError } = await admin.from("tenant_access_roles").select("slug").eq("tenant_id", tenantId);
if (roleError) throw roleError;
for (const slug of ["admin", "moderator", "course-chair", "course-instructor", "editor"]) {
  if (!roles?.some(role => role.slug === slug)) throw new Error(`Missing preset role: ${slug}`);
}

console.log(JSON.stringify({
  guestSpaces: guestSpaces.map(space => space.slug),
  associateCourses: associateCourses.map(course => course.slug),
  professionalCourses: professionalCourses.map(course => course.slug),
  moderatorFullAccess,
  presetRoles: roles.map(role => role.slug),
}, null, 2));
