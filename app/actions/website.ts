"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganizationPermission, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { RESERVED_APP_SEGMENTS, normalizePath } from "@/lib/website/routing";
import { websiteDocumentSchema } from "@/lib/website/schema";
import { PAGE_TEMPLATES, type TemplateId } from "@/lib/website/templates";

export type WebsiteActionState = { ok: boolean; message: string };

const ok = (message: string): WebsiteActionState => ({ ok: true, message });
const fail = (message: string): WebsiteActionState => ({ ok: false, message });

const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes only.").min(2).max(60);
const pathSchema = z.string().trim().regex(/^\/[A-Za-z0-9/:_-]*$/, "Use a path such as /about or /blog/:slug.").max(200);

/** Every action re-checks the permission; the nav gate is a convenience, not the boundary. */
async function requireWebsiteAccess() {
  const organization = await requireOrganizationPermission("website.manage");
  const user = await verifyUser();
  const supabase = await createClient();
  return { organization, user, supabase };
}

/** Confirms the site belongs to the caller's tenant before any nested write. */
async function requireSite(siteId: string) {
  const context = await requireWebsiteAccess();
  const { data } = await context.supabase
    .from("website_sites").select("id, tenant_id, slug").eq("id", siteId).eq("tenant_id", context.organization.id).maybeSingle();
  if (!data) return null;
  return { ...context, site: data as { id: string; tenant_id: string; slug: string } };
}

function revalidateSite(siteId: string) {
  revalidatePath("/website");
  revalidatePath(`/website/${siteId}`);
}

// --- Sites -----------------------------------------------------------------------

export async function createSite(_state: WebsiteActionState | undefined, formData: FormData): Promise<WebsiteActionState> {
  const { organization, user, supabase } = await requireWebsiteAccess();
  const parsed = z.object({
    name: z.string().trim().min(2, "Give the site a name.").max(120),
    slug: slugSchema,
    description: z.string().trim().max(400).optional(),
  }).safeParse({
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the site details.");

  const { data: site, error } = await supabase.from("website_sites").insert({
    tenant_id: organization.id,
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description || null,
    created_by: user.id,
  }).select("id").single();
  if (error) return fail(error.code === "23505" ? "That site address is already in use." : `Could not create the site: ${error.message}`);

  // A site with no pages cannot be previewed, so seed a home page from the landing template.
  const document = PAGE_TEMPLATES.landing.build();
  const { data: page } = await supabase.from("website_pages").insert({
    site_id: site.id,
    tenant_id: organization.id,
    name: "Home",
    path: "/",
    kind: "landing",
    title: parsed.data.name,
    document,
    created_by: user.id,
  }).select("id").single();
  if (page) await supabase.from("website_sites").update({ home_page_id: page.id }).eq("id", site.id);

  revalidatePath("/website");
  return ok("Site created.");
}

export async function updateSite(_state: WebsiteActionState | undefined, formData: FormData): Promise<WebsiteActionState> {
  const siteId = String(formData.get("siteId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return fail("That site could not be found.");

  const parsed = z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(400).optional(),
    status: z.enum(["draft", "published"]),
  }).safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    status: formData.get("status") ?? "draft",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the site details.");

  const { error } = await context.supabase.from("website_sites").update({
    name: parsed.data.name,
    description: parsed.data.description || null,
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
  }).eq("id", siteId);
  if (error) return fail(`Could not save the site: ${error.message}`);

  revalidateSite(siteId);
  return ok(parsed.data.status === "published" ? "Site published." : "Site saved.");
}

export async function deleteSite(formData: FormData): Promise<void> {
  const siteId = String(formData.get("siteId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return;
  await context.supabase.from("website_sites").delete().eq("id", siteId);
  revalidatePath("/website");
}

// --- Pages -----------------------------------------------------------------------

export async function createPage(_state: WebsiteActionState | undefined, formData: FormData): Promise<WebsiteActionState> {
  const siteId = String(formData.get("siteId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return fail("That site could not be found.");

  const parsed = z.object({
    name: z.string().trim().min(1, "Name the page.").max(160),
    path: pathSchema,
    template: z.enum(["blank", "landing", "event", "funnel", "collection"]),
    collectionId: z.union([z.uuid(), z.literal("")]).optional(),
  }).safeParse({
    name: formData.get("name") ?? "",
    path: formData.get("path") ?? "",
    template: formData.get("template") ?? "blank",
    collectionId: formData.get("collectionId") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the page details.");

  const template = PAGE_TEMPLATES[parsed.data.template as TemplateId];
  const path = normalizePath(parsed.data.path);
  if (template.kind === "collection_template") {
    if (!parsed.data.collectionId) return fail("Choose the collection this template renders.");
    if (!path.includes("/:")) return fail("A collection template needs a parameter, such as /blog/:slug.");
  }

  const { error } = await context.supabase.from("website_pages").insert({
    site_id: siteId,
    tenant_id: context.organization.id,
    name: parsed.data.name,
    path,
    kind: template.kind,
    title: parsed.data.name,
    collection_id: template.kind === "collection_template" ? parsed.data.collectionId : null,
    document: template.build(),
    created_by: context.user.id,
  });
  if (error) return fail(error.code === "23505" ? "A page already uses that path." : `Could not create the page: ${error.message}`);

  revalidateSite(siteId);
  return ok("Page created.");
}

export async function updatePageSettings(_state: WebsiteActionState | undefined, formData: FormData): Promise<WebsiteActionState> {
  const siteId = String(formData.get("siteId") ?? "");
  const pageId = String(formData.get("pageId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return fail("That site could not be found.");

  const parsed = z.object({
    name: z.string().trim().min(1).max(160),
    path: pathSchema,
    title: z.string().trim().max(200).optional(),
    description: z.string().trim().max(400).optional(),
  }).safeParse({
    name: formData.get("name") ?? "",
    path: formData.get("path") ?? "",
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the page details.");

  const { error } = await context.supabase.from("website_pages").update({
    name: parsed.data.name,
    path: normalizePath(parsed.data.path),
    title: parsed.data.title || null,
    description: parsed.data.description || null,
    updated_at: new Date().toISOString(),
  }).eq("id", pageId).eq("site_id", siteId);
  if (error) return fail(error.code === "23505" ? "A page already uses that path." : `Could not save the page: ${error.message}`);

  revalidateSite(siteId);
  return ok("Page saved.");
}

/** Autosave target for the builder canvas. */
export async function savePageDocument(siteId: string, pageId: string, document: unknown): Promise<WebsiteActionState> {
  const context = await requireSite(siteId);
  if (!context) return fail("That site could not be found.");

  const parsed = websiteDocumentSchema.safeParse(document);
  if (!parsed.success) return fail("The page layout could not be saved because it failed validation.");

  const { error } = await context.supabase.from("website_pages")
    .update({ document: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", pageId).eq("site_id", siteId);
  if (error) return fail(`Could not save the layout: ${error.message}`);
  return ok("Saved.");
}

/** Snapshots the draft document into an immutable version and points the page at it. */
export async function publishPage(siteId: string, pageId: string): Promise<WebsiteActionState> {
  const context = await requireSite(siteId);
  if (!context) return fail("That site could not be found.");

  const { data: page } = await context.supabase
    .from("website_pages").select("document, name").eq("id", pageId).eq("site_id", siteId).maybeSingle();
  if (!page) return fail("That page could not be found.");

  const { data: version, error: versionError } = await context.supabase.from("website_page_versions").insert({
    page_id: pageId,
    tenant_id: context.organization.id,
    document: page.document,
    label: `Published ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    created_by: context.user.id,
  }).select("id").single();
  if (versionError || !version) return fail(`Could not publish the page: ${versionError?.message ?? "unknown error"}`);

  const { error } = await context.supabase.from("website_pages")
    .update({ status: "published", published_version_id: version.id, updated_at: new Date().toISOString() })
    .eq("id", pageId).eq("site_id", siteId);
  if (error) return fail(`Could not publish the page: ${error.message}`);

  revalidateSite(siteId);
  return ok("Page published.");
}

export async function unpublishPage(formData: FormData): Promise<void> {
  const siteId = String(formData.get("siteId") ?? "");
  const pageId = String(formData.get("pageId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return;
  await context.supabase.from("website_pages").update({ status: "draft" }).eq("id", pageId).eq("site_id", siteId);
  revalidateSite(siteId);
}

export async function deletePage(formData: FormData): Promise<void> {
  const siteId = String(formData.get("siteId") ?? "");
  const pageId = String(formData.get("pageId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return;
  await context.supabase.from("website_pages").delete().eq("id", pageId).eq("site_id", siteId);
  revalidateSite(siteId);
}

// --- Domains ---------------------------------------------------------------------

export async function addDomain(_state: WebsiteActionState | undefined, formData: FormData): Promise<WebsiteActionState> {
  const siteId = String(formData.get("siteId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return fail("That site could not be found.");

  const kind = String(formData.get("kind") ?? "");
  const parsedKind = z.enum(["subdomain", "custom", "directory"]).safeParse(kind);
  if (!parsedKind.success) return fail("Choose how the site should be reached.");

  if (parsedKind.data === "directory") {
    const parsed = slugSchema.safeParse(formData.get("basePath") ?? "");
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a directory name.");
    if (RESERVED_APP_SEGMENTS.has(parsed.data)) return fail(`"${parsed.data}" is reserved by the application.`);
    // Directory mounts live on a host we already control, so there is nothing to verify.
    const { error } = await context.supabase.from("website_domains").insert({
      site_id: siteId, tenant_id: context.organization.id, kind: "directory",
      base_path: parsed.data, status: "verified", verified_at: new Date().toISOString(),
    });
    if (error) return fail(error.code === "23505" ? "That directory is already taken." : `Could not add the directory: ${error.message}`);
    revalidateSite(siteId);
    return ok("Directory mount added.");
  }

  const parsed = z.string().trim().toLowerCase()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Enter a hostname such as www.example.com.")
    .max(253).safeParse(formData.get("host") ?? "");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a valid hostname.");

  // A subdomain of a host we already serve needs no DNS proof; a custom domain does.
  const autoVerify = parsedKind.data === "subdomain" || process.env.WEBSITE_ALLOW_UNVERIFIED_DOMAINS === "true";
  const { error } = await context.supabase.from("website_domains").insert({
    site_id: siteId, tenant_id: context.organization.id, kind: parsedKind.data,
    host: parsed.data,
    status: autoVerify ? "verified" : "pending",
    verified_at: autoVerify ? new Date().toISOString() : null,
  });
  if (error) return fail(error.code === "23505" ? "That hostname is already connected." : `Could not add the domain: ${error.message}`);

  revalidateSite(siteId);
  return ok(autoVerify ? "Domain connected." : "Domain added. Add the TXT record, then verify it.");
}

/**
 * Checks the DNS TXT record proving control of a custom domain. Nothing is provisioned
 * here — DNS and TLS stay with the hosting provider.
 */
export async function verifyDomain(formData: FormData): Promise<void> {
  const siteId = String(formData.get("siteId") ?? "");
  const domainId = String(formData.get("domainId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return;

  const { data: domain } = await context.supabase
    .from("website_domains").select("host, verification_token").eq("id", domainId).eq("site_id", siteId).maybeSingle();
  if (!domain?.host) return;

  let verified = false;
  let message: string | null = null;
  try {
    const { resolveTxt } = await import("node:dns/promises");
    const records = await resolveTxt(`_commune-verify.${domain.host}`);
    verified = records.flat().some((record) => record.trim() === domain.verification_token);
    if (!verified) message = "The TXT record was found but did not match the verification token.";
  } catch (error) {
    message = error instanceof Error && "code" in error && error.code === "ENOTFOUND"
      ? "No _commune-verify TXT record was found for that hostname."
      : `DNS lookup failed: ${error instanceof Error ? error.message : "unknown error"}`;
  }

  await context.supabase.from("website_domains").update({
    status: verified ? "verified" : "error",
    error_message: verified ? null : message,
    verified_at: verified ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", domainId).eq("site_id", siteId);

  revalidateSite(siteId);
}

export async function setPrimaryDomain(formData: FormData): Promise<void> {
  const siteId = String(formData.get("siteId") ?? "");
  const domainId = String(formData.get("domainId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return;
  // A partial unique index allows only one primary per site, so clear the old one first.
  await context.supabase.from("website_domains").update({ is_primary: false }).eq("site_id", siteId);
  await context.supabase.from("website_domains").update({ is_primary: true }).eq("id", domainId).eq("site_id", siteId);
  revalidateSite(siteId);
}

export async function removeDomain(formData: FormData): Promise<void> {
  const siteId = String(formData.get("siteId") ?? "");
  const domainId = String(formData.get("domainId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return;
  await context.supabase.from("website_domains").delete().eq("id", domainId).eq("site_id", siteId);
  revalidateSite(siteId);
}

// --- CMS -------------------------------------------------------------------------

const fieldSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_]*$/, "Field keys use lowercase letters, numbers, and underscores.").max(40),
  label: z.string().trim().min(1).max(80),
  type: z.enum(["text", "textarea", "number", "boolean", "url", "date", "image"]),
  required: z.boolean().optional(),
});

export async function createCollection(_state: WebsiteActionState | undefined, formData: FormData): Promise<WebsiteActionState> {
  const siteId = String(formData.get("siteId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return fail("That site could not be found.");

  const parsed = z.object({
    name: z.string().trim().min(2, "Name the collection.").max(120),
    slug: slugSchema,
    description: z.string().trim().max(400).optional(),
  }).safeParse({
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the collection details.");

  const { error } = await context.supabase.from("website_collections").insert({
    site_id: siteId,
    tenant_id: context.organization.id,
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description || null,
    // Every entry has a title; a body field makes the collection immediately useful.
    fields: [{ key: "body", label: "Body", type: "textarea", required: false }],
  });
  if (error) return fail(error.code === "23505" ? "That collection address is already in use." : `Could not create the collection: ${error.message}`);

  revalidateSite(siteId);
  return ok("Collection created.");
}

export async function updateCollectionFields(_state: WebsiteActionState | undefined, formData: FormData): Promise<WebsiteActionState> {
  const siteId = String(formData.get("siteId") ?? "");
  const collectionId = String(formData.get("collectionId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return fail("That site could not be found.");

  let raw: unknown;
  try { raw = JSON.parse(String(formData.get("fields") ?? "[]")); }
  catch { return fail("The field definitions could not be read."); }

  const parsed = z.array(fieldSchema).max(40).safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the field definitions.");

  const { error } = await context.supabase.from("website_collections")
    .update({ fields: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", collectionId).eq("site_id", siteId);
  if (error) return fail(`Could not save the fields: ${error.message}`);

  revalidateSite(siteId);
  return ok("Fields saved.");
}

export async function deleteCollection(formData: FormData): Promise<void> {
  const siteId = String(formData.get("siteId") ?? "");
  const collectionId = String(formData.get("collectionId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return;
  await context.supabase.from("website_collections").delete().eq("id", collectionId).eq("site_id", siteId);
  revalidateSite(siteId);
}

export async function saveEntry(_state: WebsiteActionState | undefined, formData: FormData): Promise<WebsiteActionState> {
  const siteId = String(formData.get("siteId") ?? "");
  const collectionId = String(formData.get("collectionId") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return fail("That site could not be found.");

  const { data: collection } = await context.supabase
    .from("website_collections").select("id, fields").eq("id", collectionId).eq("site_id", siteId).maybeSingle();
  if (!collection) return fail("That collection could not be found.");

  const parsed = z.object({
    title: z.string().trim().min(1, "Give the entry a title.").max(200),
    slug: slugSchema,
    status: z.enum(["draft", "published"]),
  }).safeParse({
    title: formData.get("title") ?? "",
    slug: formData.get("slug") ?? "",
    status: formData.get("status") ?? "draft",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the entry details.");

  // Only keys declared on the collection are stored, so a tampered form cannot widen the row.
  const fields = (collection.fields ?? []) as { key: string; type: string }[];
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    const value = formData.get(`field.${field.key}`);
    if (value === null) continue;
    if (field.type === "boolean") data[field.key] = value === "on" || value === "true";
    else if (field.type === "number") data[field.key] = Number(value) || 0;
    else data[field.key] = String(value).slice(0, 20000);
  }

  const payload = {
    collection_id: collectionId,
    tenant_id: context.organization.id,
    title: parsed.data.title,
    slug: parsed.data.slug,
    status: parsed.data.status,
    data,
    published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = entryId
    ? await context.supabase.from("website_collection_entries").update(payload).eq("id", entryId).eq("collection_id", collectionId)
    : await context.supabase.from("website_collection_entries").insert({ ...payload, created_by: context.user.id });
  if (error) return fail(error.code === "23505" ? "That entry address is already in use." : `Could not save the entry: ${error.message}`);

  revalidateSite(siteId);
  return ok(parsed.data.status === "published" ? "Entry published." : "Entry saved.");
}

export async function deleteEntry(formData: FormData): Promise<void> {
  const siteId = String(formData.get("siteId") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  const context = await requireSite(siteId);
  if (!context) return;
  await context.supabase.from("website_collection_entries").delete().eq("id", entryId).eq("tenant_id", context.organization.id);
  revalidateSite(siteId);
}
