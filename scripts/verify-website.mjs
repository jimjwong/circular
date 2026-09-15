import { createClient } from "@supabase/supabase-js";

// Checks the website builder end to end against the local stack: schema presence, the
// public delivery path through anon RLS, and that authoring stays behind website.manage.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !secret || !publishable) throw new Error("Website verification environment is incomplete.");

const admin = createClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(supabaseUrl, publishable, { auth: { persistSession: false, autoRefreshToken: false } });

const checks = {};
const fail = (message) => { throw new Error(message); };

// 1. Schema and permission wiring.
for (const table of ["website_sites", "website_pages", "website_page_versions", "website_domains", "website_collections", "website_collection_entries"]) {
  const { error } = await admin.from(table).select("id").limit(1);
  if (error) fail(`Table ${table} is not queryable: ${error.message}`);
}
checks.tables = "present";

const { data: permission } = await admin.from("access_permissions").select("key").eq("key", "website.manage");
if (!permission?.length) fail("The website.manage permission is missing.");
checks.permission = "website.manage";

// 2. Public delivery: a published page on a published site must be readable by anon,
//    and a draft must not be.
const { data: publishedPages } = await anon.from("website_pages").select("id, status").limit(50);
if ((publishedPages ?? []).some((page) => page.status !== "published")) fail("anon can read a draft page.");
checks.anonPages = `${publishedPages?.length ?? 0} published page(s) visible`;

const { data: anonSites } = await anon.from("website_sites").select("id, status").limit(50);
if ((anonSites ?? []).some((site) => site.status !== "published")) fail("anon can read an unpublished site.");
checks.anonSites = `${anonSites?.length ?? 0} published site(s) visible`;

const { data: anonEntries } = await anon.from("website_collection_entries").select("id, status").limit(50);
if ((anonEntries ?? []).some((entry) => entry.status !== "published")) fail("anon can read a draft collection entry.");
checks.anonEntries = `${anonEntries?.length ?? 0} published entry/entries visible`;

// 3. Authoring is closed to anonymous callers.
const tenant = (await admin.from("website_sites").select("tenant_id").limit(1)).data?.[0]?.tenant_id
  ?? (await admin.from("tenants").select("id").limit(1)).data?.[0]?.id;
if (!tenant) fail("No tenant is available to test writes against.");
const { error: writeError } = await anon.from("website_sites").insert({
  tenant_id: tenant, name: "Verification probe", slug: `probe-${Date.now()}`,
  created_by: "00000000-0000-0000-0000-000000000000",
});
if (!writeError) fail("anon was able to create a site.");
checks.anonWrite = "denied";

// 4. Only verified domains resolve publicly, and every host is unique.
const { data: domains } = await anon.from("website_domains").select("id, kind, host, base_path, status");
if ((domains ?? []).some((domain) => domain.status !== "verified")) fail("anon can resolve an unverified domain.");
const hosts = (domains ?? []).map((domain) => domain.host).filter(Boolean);
if (new Set(hosts).size !== hosts.length) fail("Duplicate hosts are connected.");
checks.domains = `${domains?.length ?? 0} verified address(es)`;

// 5. Public content helpers exist for the Commune blocks.
const siteId = (await admin.from("website_sites").select("id").limit(1)).data?.[0]?.id;
if (siteId) {
  const { error: eventsError } = await anon.rpc("website_public_events", { check_site_id: siteId, max_count: 1 });
  const { error: coursesError } = await anon.rpc("website_public_courses", { check_site_id: siteId, max_count: 1 });
  if (eventsError) fail(`website_public_events is not callable by anon: ${eventsError.message}`);
  if (coursesError) fail(`website_public_courses is not callable by anon: ${coursesError.message}`);
  checks.publicContentRpc = "callable";
}

console.log(JSON.stringify(checks, null, 2));
