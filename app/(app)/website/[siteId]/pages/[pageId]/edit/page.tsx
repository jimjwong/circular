import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BuilderShell } from "@/components/website/builder/builder-shell";
import { requireOrganizationPermission } from "@/lib/auth/dal";
import { getPage, getSite, listCollections, listDomains, listPages } from "@/lib/website/queries";
import { previewUrlFor } from "@/lib/website/preview";

export default async function PageBuilderRoute({ params }: { params: Promise<{ siteId: string; pageId: string }> }) {
  const organization = await requireOrganizationPermission("website.manage");
  const { siteId, pageId } = await params;

  const site = await getSite(organization.id, siteId);
  if (!site) notFound();
  const page = await getPage(siteId, pageId);
  if (!page) notFound();

  const [collections, domains, sitePages] = await Promise.all([listCollections(siteId), listDomains(siteId), listPages(siteId)]);
  const base = previewUrlFor(domains, (await headers()).get("host"));
  // A dynamic template has no single live URL, so only concrete paths get a preview link.
  const previewUrl = base && page.status === "published" && !page.path.includes("/:")
    ? `${base}${page.path === "/" ? "" : page.path}`
    : null;

  return (
    <BuilderShell
      siteId={siteId}
      pageId={pageId}
      pageName={page.name}
      pagePath={page.path}
      previewUrl={previewUrl}
      initialDocument={page.document}
      collections={collections}
      pages={sitePages.map((entry) => ({ name: entry.name, path: entry.path }))}
      isPublished={page.status === "published"}
    />
  );
}
