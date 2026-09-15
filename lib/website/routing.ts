// Host and path resolution shared by the proxy and the public site routes.
// This module must stay dependency-free: proxy.ts imports it.

/**
 * Every static top-level route the application owns. A directory mount may not use one
 * of these names, and the proxy uses the list to decide whether a first path segment
 * could belong to a site instead of the app.
 *
 * Adding a new top-level route to app/ means adding it here too.
 */
export const RESERVED_APP_SEGMENTS = new Set([
  "admin", "api", "auth", "badges", "community", "courses", "dashboard", "email",
  "events", "forgot-password", "invite", "learn", "learning", "login", "members",
  "notifications", "onboarding", "organization-unavailable", "platform", "settings",
  "signup", "site", "spaces", "team", "update-password", "verify", "website",
  "_next", "favicon.ico", ".well-known",
]);

/** Path the proxy rewrites host-based site traffic to. */
export const SITE_RENDER_PREFIX = "/site";

/** Header the proxy sets on a rewrite, so the render route can reject direct hits. */
export const SITE_HEADER = "x-commune-site";

/** Every hostname the application itself answers on. Accepts a comma-separated list. */
export function appHosts(): string[] {
  const configured = (process.env.NEXT_PUBLIC_APP_HOST ?? "")
    .split(",").map((host) => normalizeHost(host)).filter(Boolean);
  if (configured.length) return configured;
  try {
    return [normalizeHost(new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001").host)];
  } catch {
    return ["localhost"];
  }
}

/** The address shown to admins when describing directory mounts. */
export function appHost() {
  return appHosts()[0];
}

function isIpAddress(host: string) {
  // IPv6 arrives bracketed and is reduced to '[' by normalizeHost.
  return host === "[" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/**
 * Whether a request belongs to the application rather than to a published site.
 *
 * Sites are only ever reached through a real hostname, so loopback names and bare IP
 * addresses always mean the app — that is how the dev server is reached over a LAN or
 * Tailscale address, and treating those as site traffic would 404 the whole app.
 */
export function isAppHost(host: string) {
  const normalized = normalizeHost(host);
  if (!normalized) return true;
  if (appHosts().includes(normalized)) return true;
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  return isIpAddress(normalized);
}

/** Lowercases and drops the port, so 'Acme.test:3001' and 'acme.test' resolve alike. */
export function normalizeHost(host: string) {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith("[")) return "[";
  return trimmed.split(":")[0];
}

export function firstSegment(pathname: string) {
  return pathname.split("/").filter(Boolean)[0] ?? "";
}

/**
 * True when a path may address a directory mount. Such paths are let through the proxy
 * without a login redirect; the route itself still enforces auth on the non-site branch.
 */
export function isPossibleDirectoryMount(pathname: string) {
  const segment = firstSegment(pathname);
  return segment.length > 0 && !RESERVED_APP_SEGMENTS.has(segment) && !segment.includes(".");
}

export type SitePageRoute = { id: string; path: string; kind: string; collection_id: string | null };

export type PageMatch<T extends SitePageRoute> = { page: T; param?: string };

function segmentsOf(path: string) {
  return path.split("/").filter(Boolean);
}

/**
 * Finds the page serving a request path. An exact path wins; otherwise a collection
 * template such as '/blog/:slug' matches and its parameter is returned so the caller can
 * look the entry up.
 */
export function matchPagePath<T extends SitePageRoute>(pages: T[], requestedPath: string): PageMatch<T> | null {
  const normalized = normalizePath(requestedPath);
  const exact = pages.find((page) => normalizePath(page.path) === normalized);
  if (exact) return { page: exact };

  const requested = segmentsOf(normalized);
  for (const page of pages) {
    const template = segmentsOf(page.path);
    if (template.length !== requested.length) continue;
    let param: string | undefined;
    let matches = true;
    for (let index = 0; index < template.length; index += 1) {
      const templateSegment = template[index];
      if (templateSegment.startsWith(":")) {
        param = requested[index];
        continue;
      }
      if (templateSegment !== requested[index]) { matches = false; break; }
    }
    if (matches && param) return { page, param };
  }
  return null;
}

/** Normalizes to a leading slash with no trailing slash; the site root is '/'. */
export function normalizePath(path: string) {
  const trimmed = `/${path}`.replaceAll(/\/+/g, "/").replace(/\/$/, "");
  return trimmed === "" ? "/" : trimmed.toLowerCase();
}

export function isDynamicPath(path: string) {
  return segmentsOf(path).some((segment) => segment.startsWith(":"));
}
