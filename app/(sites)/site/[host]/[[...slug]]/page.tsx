import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicSite } from "@/components/website/public-site";
import { loadPublicPage, loadRenderData, resolveSiteByHost } from "@/lib/website/queries";
import { SITE_HEADER } from "@/lib/website/routing";
import { siteMetaTitle } from "@/lib/website/preview";

type Params = { host: string; slug?: string[] };

/**
 * Renders a published site reached through a custom domain or subdomain. The proxy
 * rewrites host traffic here; a direct request without that rewrite is not a real site
 * visit and is refused.
 */
async function resolve({ host, slug }: Params) {
  const headerList = await headers();
  if (headerList.get(SITE_HEADER) !== "1") return null;

  const resolved = await resolveSiteByHost(host);
  if (!resolved) return null;

  const path = `/${(slug ?? []).join("/")}`;
  const published = await loadPublicPage(resolved.site, path);
  if (!published) return null;
  return { ...resolved, ...published };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const resolved = await resolve(await params);
  if (!resolved) return { title: "Page not found" };
  const title = resolved.entry?.title ?? resolved.page.title ?? resolved.page.name;
  return {
    title: siteMetaTitle(title, resolved.site.name),
    description: resolved.page.description ?? resolved.site.description ?? undefined,
    openGraph: { images: resolved.page.social_image_url ?? resolved.site.social_image_url ?? undefined },
  };
}

export default async function SiteHostPage({ params }: { params: Promise<Params> }) {
  const resolved = await resolve(await params);
  if (!resolved) notFound();
  const data = await loadRenderData(resolved.site, resolved.document, { basePath: "", routes: resolved.routes });
  return <PublicSite document={resolved.document} data={data} entry={resolved.entry} />;
}
