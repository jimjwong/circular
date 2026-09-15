import { createClient } from "@supabase/supabase-js";
import { PAGE_TEMPLATES } from "../lib/website/templates.ts";

// Seeds a published demo website for the owner's workspace: a landing home page, an
// events page, a blog collection with entries, a collection template, and a directory
// mount so the result is reachable at http://localhost:3001/collective.
// Re-running the script refreshes the same records rather than creating duplicates.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Supabase local environment variables are required.");

const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

// Prefer the demo owner's workspace so the EventList and CourseList blocks have real
// content to render; fall back to any owner membership.
const { data: demoUser } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
const demoOwnerId = demoUser?.users.find((user) => user.email === "owner@commune.demo")?.id;

const { data: owner } = demoOwnerId
  ? await supabase.from("tenant_memberships").select("tenant_id, user_id").eq("role", "owner").eq("user_id", demoOwnerId).limit(1).maybeSingle()
  : { data: null };
const { data: fallbackOwner } = owner
  ? { data: owner }
  : await supabase.from("tenant_memberships").select("tenant_id, user_id").eq("role", "owner").limit(1).maybeSingle();
if (!fallbackOwner) throw new Error("No workspace owner found. Run pnpm seed:demo first.");
const { tenant_id: tenantId, user_id: userId } = fallbackOwner;

const SITE_SLUG = "collective";
const MOUNT = "collective";

async function upsertSite() {
  const { data: existing } = await supabase.from("website_sites").select("id").eq("tenant_id", tenantId).eq("slug", SITE_SLUG).maybeSingle();
  const payload = {
    tenant_id: tenantId, name: "The Collective", slug: SITE_SLUG,
    description: "Public site for the demo community.", status: "published",
    created_by: userId, updated_at: new Date().toISOString(),
  };
  if (existing) {
    await supabase.from("website_sites").update(payload).eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await supabase.from("website_sites").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

/** Writes a page and immediately publishes it by snapshotting a version. */
async function upsertPage(siteId, { name, path, templateId, collectionId = null }) {
  const document = PAGE_TEMPLATES[templateId].build();
  const kind = PAGE_TEMPLATES[templateId].kind;
  const base = {
    site_id: siteId, tenant_id: tenantId, name, path, kind, title: name,
    collection_id: collectionId, document, status: "published",
    created_by: userId, updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase.from("website_pages").select("id").eq("site_id", siteId).eq("path", path).maybeSingle();
  let pageId = existing?.id;
  if (pageId) await supabase.from("website_pages").update(base).eq("id", pageId);
  else {
    const { data, error } = await supabase.from("website_pages").insert(base).select("id").single();
    if (error) throw error;
    pageId = data.id;
  }

  const { data: version, error: versionError } = await supabase.from("website_page_versions").insert({
    page_id: pageId, tenant_id: tenantId, document, label: "Seeded", created_by: userId,
  }).select("id").single();
  if (versionError) throw versionError;
  await supabase.from("website_pages").update({ published_version_id: version.id }).eq("id", pageId);
  return pageId;
}

async function upsertCollection(siteId) {
  const payload = {
    site_id: siteId, tenant_id: tenantId, name: "Blog", slug: "blog",
    description: "Posts published on the public site.",
    fields: [
      { key: "excerpt", label: "Excerpt", type: "text", required: false },
      { key: "body", label: "Body", type: "textarea", required: true },
    ],
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase.from("website_collections").select("id").eq("site_id", siteId).eq("slug", "blog").maybeSingle();
  if (existing) {
    await supabase.from("website_collections").update(payload).eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await supabase.from("website_collections").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

async function upsertEntry(collectionId, { slug, title, excerpt, body, status = "published" }) {
  const payload = {
    collection_id: collectionId, tenant_id: tenantId, slug, title, status,
    data: { excerpt, body },
    published_at: status === "published" ? new Date().toISOString() : null,
    created_by: userId, updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase.from("website_collection_entries").select("id").eq("collection_id", collectionId).eq("slug", slug).maybeSingle();
  if (existing) await supabase.from("website_collection_entries").update(payload).eq("id", existing.id);
  else {
    const { error } = await supabase.from("website_collection_entries").insert(payload);
    if (error) throw error;
  }
}

async function upsertDirectoryMount(siteId) {
  const { data: existing } = await supabase.from("website_domains").select("id").eq("site_id", siteId).eq("kind", "directory").maybeSingle();
  const payload = {
    site_id: siteId, tenant_id: tenantId, kind: "directory", base_path: MOUNT,
    is_primary: true, status: "verified", verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (existing) await supabase.from("website_domains").update(payload).eq("id", existing.id);
  else {
    const { error } = await supabase.from("website_domains").insert(payload);
    if (error && error.code !== "23505") throw error;
  }
}

const siteId = await upsertSite();
const collectionId = await upsertCollection(siteId);

const homeId = await upsertPage(siteId, { name: "Home", path: "/", templateId: "landing" });
await upsertPage(siteId, { name: "Events", path: "/events", templateId: "event" });
await upsertPage(siteId, { name: "Join", path: "/join", templateId: "funnel" });
await upsertPage(siteId, { name: "Blog post", path: "/blog/:slug", templateId: "collection", collectionId });
await supabase.from("website_sites").update({ home_page_id: homeId }).eq("id", siteId);

await upsertEntry(collectionId, {
  slug: "why-we-build-in-public",
  title: "Why we build in public",
  excerpt: "Sharing the work as it happens compounds trust.",
  body: "Building in public turns your process into the product story. This entry is seeded demo content.",
});
await upsertEntry(collectionId, {
  slug: "running-better-workshops",
  title: "Running better workshops",
  excerpt: "Small rooms, clear outcomes, and honest feedback.",
  body: "A workshop works when everyone leaves with something they can use tomorrow. This entry is seeded demo content.",
});
await upsertEntry(collectionId, {
  slug: "unpublished-draft",
  title: "An unpublished draft",
  excerpt: "Should never appear publicly.",
  body: "This draft exists so the verification script can prove drafts stay private.",
  status: "draft",
});

await upsertDirectoryMount(siteId);

const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3001";
console.log(JSON.stringify({
  site: "The Collective",
  pages: ["/", "/events", "/join", "/blog/:slug"],
  entries: 3,
  publicUrls: [`${origin}/${MOUNT}`, `${origin}/${MOUNT}/events`, `${origin}/${MOUNT}/blog/why-we-build-in-public`],
}, null, 2));
