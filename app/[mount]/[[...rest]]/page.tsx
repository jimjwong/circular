import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CommunityPage from "@/app/(app)/community/page";
import { ThemeShell } from "@/components/themes/theme-shell";
import { PublicSite } from "@/components/website/public-site";
import { getActiveOrganization, getOptionalActiveOrganization } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { loadPublicPage, loadRenderData, resolveSiteByDirectory } from "@/lib/website/queries";
import { siteMetaTitle } from "@/lib/website/preview";

type Params = { mount: string; rest?: string[] };

// A first path segment can mean two things: a site mounted on a directory (public), or
// the vanity alias for a signed-in member's own community (authenticated) — and a
// tenant's slug can coincidentally equal its own site's mount (the demo tenant and its
// public site are both "apss"). The alias only ever matches a bare mount with no
// sub-path, so it's checked first only then — a signed-in member always reaches their
// own community at that path even when a public site happens to share its address;
// anyone else (anonymous, or signed in but this isn't their org) sees the site.
async function resolveMountedSite({ mount, rest }: Params) {
  if (!rest?.length) {
    const organization = await getOptionalActiveOrganization();
    if (organization?.slug === mount) return null;
  }
  const resolved = await resolveSiteByDirectory(mount);
  if (!resolved) return null;
  const path = `/${(rest ?? []).join("/")}`;
  const published = await loadPublicPage(resolved.site, path);
  if (!published) return null;
  return { ...resolved, ...published };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const resolved = await resolveMountedSite(await params);
  if (!resolved) return {};
  const title = resolved.entry?.title ?? resolved.page.title ?? resolved.page.name;
  return {
    title: siteMetaTitle(title, resolved.site.name),
    description: resolved.page.description ?? resolved.site.description ?? undefined,
  };
}

export default async function MountedPage({ params }: { params: Promise<Params> }) {
  const resolvedParams = await params;
  const site = await resolveMountedSite(resolvedParams);
  if (site) {
    const data = await loadRenderData(site.site, site.document, { basePath: `/${resolvedParams.mount}`, routes: site.routes });
    return <PublicSite document={site.document} data={data} entry={site.entry} />;
  }

  // Not a mount: fall back to the community alias. getActiveOrganization redirects
  // anonymous visitors to the login page through verifyUser.
  if (resolvedParams.rest?.length) notFound();
  const organization = await getActiveOrganization();
  if (!organization || organization.slug !== resolvedParams.mount) notFound();

  const supabase = await createClient();
  const { data: tenant } = await supabase.from("tenants").select("theme_preset, theme_config").eq("id", organization.id).maybeSingle();
  return (
    <ThemeShell preset={tenant?.theme_preset ?? "forest"} config={tenant?.theme_config ?? {}}>
      <CommunityPage searchParams={Promise.resolve({})} />
    </ThemeShell>
  );
}
