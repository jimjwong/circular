import type { WebsiteDomain } from "@/lib/website/queries";

/** Avoids "Acme · Acme" when a page carries the same title as its site. */
export function siteMetaTitle(pageTitle: string, siteName: string) {
  const title = pageTitle.trim();
  return !title || title === siteName ? siteName : `${title} · ${siteName}`;
}

/** The directory mount a site is served from, or "" when it has none. */
export function siteBasePath(domains: WebsiteDomain[]) {
  const mount = domains.find((domain) => domain.kind === "directory" && domain.status === "verified");
  return mount?.base_path ? `/${mount.base_path}` : "";
}

/**
 * Picks the address to show as "visit site".
 *
 * A directory mount resolves to a *relative* path on purpose: the admin may be browsing
 * over localhost, a LAN address, or a tunnel, and an absolute URL built from
 * NEXT_PUBLIC_SITE_URL would send them to the wrong machine. Host-backed domains have no
 * relative form, so they reuse the scheme and port of the request that is being served.
 */
export function previewUrlFor(domains: WebsiteDomain[], requestHost?: string | null): string | null {
  const verified = domains.filter((domain) => domain.status === "verified");
  if (!verified.length) return null;

  const primary = verified.find((domain) => domain.is_primary);
  const directory = verified.find((domain) => domain.kind === "directory");
  const chosen = primary?.kind === "directory" ? primary : directory ?? primary ?? verified[0];

  if (chosen.kind === "directory") return `/${chosen.base_path}`;
  if (!chosen.host) return null;

  // Mirror the current request so a locally mapped host opens on the right port.
  const port = requestHost?.includes(":") ? `:${requestHost.split(":").pop()}` : "";
  const scheme = port || requestHost?.startsWith("localhost") ? "http" : "https";
  return `${scheme}://${chosen.host}${port}`;
}
