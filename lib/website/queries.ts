import "server-only";

import { createClient } from "@/lib/supabase/server";
import { matchPagePath, normalizeHost, normalizePath } from "@/lib/website/routing";
import { parseDocument, type WebsiteDocument } from "@/lib/website/schema";
import { EMPTY_RENDER_DATA, type CollectionEntry, type WebsiteRenderData } from "@/lib/website/render";

export type WebsiteSite = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "published";
  home_page_id: string | null;
  favicon_url: string | null;
  social_image_url: string | null;
  brand: Record<string, unknown>;
  updated_at: string;
};

export type WebsitePage = {
  id: string;
  site_id: string;
  name: string;
  path: string;
  kind: "page" | "landing" | "event" | "funnel" | "collection_template";
  title: string | null;
  description: string | null;
  social_image_url: string | null;
  status: "draft" | "published";
  sort_order: number;
  collection_id: string | null;
  published_version_id: string | null;
  updated_at: string;
};

export type WebsiteDomain = {
  id: string;
  site_id: string;
  kind: "subdomain" | "custom" | "directory";
  host: string | null;
  base_path: string | null;
  is_primary: boolean;
  verification_token: string;
  status: "pending" | "verified" | "error";
  error_message: string | null;
  verified_at: string | null;
};

export type WebsiteCollection = {
  id: string;
  site_id: string;
  name: string;
  slug: string;
  description: string | null;
  fields: { key: string; label: string; type: string; required?: boolean }[];
};

export type WebsiteCollectionEntryRow = {
  id: string;
  collection_id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  data: Record<string, unknown>;
  updated_at: string;
};

const SITE_COLUMNS = "id, tenant_id, name, slug, description, status, home_page_id, favicon_url, social_image_url, brand, updated_at";
const PAGE_COLUMNS = "id, site_id, name, path, kind, title, description, social_image_url, status, sort_order, collection_id, published_version_id, updated_at";
const DOMAIN_COLUMNS = "id, site_id, kind, host, base_path, is_primary, verification_token, status, error_message, verified_at";
const COLLECTION_COLUMNS = "id, site_id, name, slug, description, fields";
const ENTRY_COLUMNS = "id, collection_id, slug, title, status, data, updated_at";

export async function listSites(tenantId: string): Promise<WebsiteSite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("website_sites").select(SITE_COLUMNS).eq("tenant_id", tenantId).order("created_at");
  if (error) throw new Error(`Unable to load websites: ${error.message}`);
  return (data ?? []) as WebsiteSite[];
}

export async function getSite(tenantId: string, siteId: string): Promise<WebsiteSite | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("website_sites").select(SITE_COLUMNS).eq("tenant_id", tenantId).eq("id", siteId).maybeSingle();
  if (error) throw new Error(`Unable to load website: ${error.message}`);
  return (data as WebsiteSite | null) ?? null;
}

export async function listPages(siteId: string): Promise<WebsitePage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("website_pages").select(PAGE_COLUMNS).eq("site_id", siteId).order("sort_order").order("created_at");
  if (error) throw new Error(`Unable to load pages: ${error.message}`);
  return (data ?? []) as WebsitePage[];
}

export async function getPage(siteId: string, pageId: string): Promise<(WebsitePage & { document: WebsiteDocument }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("website_pages").select(`${PAGE_COLUMNS}, document`).eq("site_id", siteId).eq("id", pageId).maybeSingle();
  if (error) throw new Error(`Unable to load page: ${error.message}`);
  if (!data) return null;
  return { ...(data as WebsitePage), document: parseDocument((data as { document: unknown }).document) };
}

export async function listDomains(siteId: string): Promise<WebsiteDomain[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("website_domains").select(DOMAIN_COLUMNS).eq("site_id", siteId).order("created_at");
  if (error) throw new Error(`Unable to load domains: ${error.message}`);
  return (data ?? []) as WebsiteDomain[];
}

export async function listCollections(siteId: string): Promise<WebsiteCollection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("website_collections").select(COLLECTION_COLUMNS).eq("site_id", siteId).order("created_at");
  if (error) throw new Error(`Unable to load collections: ${error.message}`);
  return (data ?? []) as WebsiteCollection[];
}

export async function getCollection(siteId: string, collectionId: string): Promise<WebsiteCollection | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("website_collections").select(COLLECTION_COLUMNS).eq("site_id", siteId).eq("id", collectionId).maybeSingle();
  if (error) throw new Error(`Unable to load collection: ${error.message}`);
  return (data as WebsiteCollection | null) ?? null;
}

export async function listEntries(collectionId: string): Promise<WebsiteCollectionEntryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("website_collection_entries").select(ENTRY_COLUMNS).eq("collection_id", collectionId).order("updated_at", { ascending: false });
  if (error) throw new Error(`Unable to load entries: ${error.message}`);
  return (data ?? []) as WebsiteCollectionEntryRow[];
}

// --- Public delivery -------------------------------------------------------------

export type ResolvedSite = { site: WebsiteSite; domain: WebsiteDomain };

/** Finds the published site served from a hostname, or null when nothing is mounted there. */
export async function resolveSiteByHost(host: string): Promise<ResolvedSite | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("website_domains")
    .select(`${DOMAIN_COLUMNS}, website_sites!inner(${SITE_COLUMNS})`)
    .eq("status", "verified")
    .in("kind", ["subdomain", "custom"])
    .ilike("host", normalizeHost(host))
    .maybeSingle();
  return unwrapResolved(data);
}

/** Finds the published site mounted at a first-level directory on the application host. */
export async function resolveSiteByDirectory(basePath: string): Promise<ResolvedSite | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("website_domains")
    .select(`${DOMAIN_COLUMNS}, website_sites!inner(${SITE_COLUMNS})`)
    .eq("status", "verified")
    .eq("kind", "directory")
    .ilike("base_path", basePath.toLowerCase())
    .maybeSingle();
  return unwrapResolved(data);
}

function unwrapResolved(data: unknown): ResolvedSite | null {
  if (!data) return null;
  const row = data as WebsiteDomain & { website_sites: WebsiteSite | WebsiteSite[] };
  const site = Array.isArray(row.website_sites) ? row.website_sites[0] : row.website_sites;
  if (!site) return null;
  const domain = { ...row } as Partial<typeof row>;
  delete domain.website_sites;
  return { site, domain: domain as WebsiteDomain };
}

export type PublicPage = {
  page: WebsitePage;
  document: WebsiteDocument;
  entry?: CollectionEntry;
  /** Every published route of the site, so the renderer can resolve internal links. */
  routes: { id: string; path: string; kind: string; collection_id: string | null }[];
};

/**
 * Resolves a request path within a site to its published document. A collection template
 * additionally resolves the entry named by its ':param' segment, and misses return null
 * so the caller can render a 404.
 */
export async function loadPublicPage(site: WebsiteSite, requestedPath: string): Promise<PublicPage | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("website_pages")
    .select(`${PAGE_COLUMNS}, website_page_versions!website_pages_published_version_fkey(document)`)
    .eq("site_id", site.id)
    .eq("status", "published");

  const rows = (data ?? []) as (WebsitePage & { website_page_versions: { document: unknown } | { document: unknown }[] | null })[];
  if (!rows.length) return null;

  const path = normalizePath(requestedPath);
  const routes = rows.map((row) => ({ id: row.id, path: row.path, kind: row.kind, collection_id: row.collection_id }));
  const match = matchPagePath(rows, path);
  if (!match) return null;

  const versionRow = match.page.website_page_versions;
  const version = Array.isArray(versionRow) ? versionRow[0] : versionRow;
  const document = parseDocument(version?.document);

  if (match.page.kind !== "collection_template") return { page: match.page, document, routes };

  if (!match.param || !match.page.collection_id) return null;
  const { data: entryRow } = await supabase
    .from("website_collection_entries")
    .select(ENTRY_COLUMNS)
    .eq("collection_id", match.page.collection_id)
    .eq("status", "published")
    .eq("slug", match.param)
    .maybeSingle();
  if (!entryRow) return null;
  const entry = entryRow as WebsiteCollectionEntryRow;
  return { page: match.page, document, routes, entry: { id: entry.id, slug: entry.slug, title: entry.title, data: entry.data } };
}

/** Collects the tenant data the Commune blocks in a document need. */
export async function loadRenderData(
  site: WebsiteSite,
  document: WebsiteDocument,
  context: { basePath: string; routes: PublicPage["routes"] },
): Promise<WebsiteRenderData> {
  const base = { ...EMPTY_RENDER_DATA, basePath: context.basePath, pageRoutes: context.routes };
  const components = new Set(document.instances.map((instance) => instance.component));
  if (!["EventList", "CourseList", "CollectionList"].some((name) => components.has(name))) {
    return base;
  }

  const supabase = await createClient();
  const data: WebsiteRenderData = { ...base, entries: {} };

  if (components.has("EventList")) {
    const { data: events } = await supabase.rpc("website_public_events", { check_site_id: site.id, max_count: 24 });
    data.events = (events ?? []) as WebsiteRenderData["events"];
  }
  if (components.has("CourseList")) {
    const { data: courses } = await supabase.rpc("website_public_courses", { check_site_id: site.id, max_count: 24 });
    data.courses = (courses ?? []) as WebsiteRenderData["courses"];
  }
  if (components.has("CollectionList")) {
    const collectionIds = [...new Set(document.props
      .filter((prop) => prop.name === "collectionId" && typeof prop.value === "string" && prop.value)
      .map((prop) => String(prop.value)))];
    if (collectionIds.length) {
      const { data: entries } = await supabase
        .from("website_collection_entries")
        .select(ENTRY_COLUMNS)
        .in("collection_id", collectionIds)
        .eq("status", "published")
        .order("published_at", { ascending: false });
      for (const row of (entries ?? []) as WebsiteCollectionEntryRow[]) {
        const bucket = data.entries[row.collection_id] ?? [];
        bucket.push({ id: row.id, slug: row.slug, title: row.title, data: row.data });
        data.entries[row.collection_id] = bucket;
      }
    }
  }
  return data;
}
