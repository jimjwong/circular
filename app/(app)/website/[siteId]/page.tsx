import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, Clock3, Database, ExternalLink, FileText, Globe2,
  Pencil, Star, Trash2, TriangleAlert,
} from "lucide-react";
import { deleteCollection, deletePage, removeDomain, setPrimaryDomain, unpublishPage, verifyDomain } from "@/app/actions/website";
import { SubmitButton } from "@/components/community/submit-button";
import { AddDomainForm, CreateCollectionForm, CreatePageForm, SiteSettingsForm } from "@/components/website/website-forms";
import { requireOrganizationPermission } from "@/lib/auth/dal";
import { getSite, listCollections, listDomains, listPages, type WebsiteDomain } from "@/lib/website/queries";
import { appHost } from "@/lib/website/routing";
import { previewUrlFor } from "@/lib/website/preview";

type Tab = "pages" | "domains" | "cms" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "pages", label: "Pages" },
  { id: "domains", label: "Domains" },
  { id: "cms", label: "CMS" },
  { id: "settings", label: "Settings" },
];

function domainLabel(domain: WebsiteDomain) {
  return domain.kind === "directory" ? `${appHost()}/${domain.base_path}` : domain.host ?? "";
}

export default async function SiteOverviewPage({ params, searchParams }: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const organization = await requireOrganizationPermission("website.manage");
  const { siteId } = await params;
  const site = await getSite(organization.id, siteId);
  if (!site) notFound();

  const tab = ((await searchParams).tab ?? "pages") as Tab;
  const [pages, domains, collections] = await Promise.all([listPages(siteId), listDomains(siteId), listCollections(siteId)]);
  // Built from the request's own host so the link works over localhost, a LAN address, or a tunnel.
  const preview = previewUrlFor(domains, (await headers()).get("host"));

  return (
    <main className="min-h-screen bg-[#f5f7f5] p-4 text-[#18251f] sm:p-7">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center gap-3">
          <Link href="/website" className="grid size-9 place-items-center rounded-xl border border-[#e0e7e2] bg-white text-[#5c6d63]" aria-label="Back to websites">
            <ArrowLeft size={16} />
          </Link>
          <span className="grid size-10 place-items-center rounded-xl bg-[#183f30] text-white"><Globe2 size={18} /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#347457]">{site.status === "published" ? "Live site" : "Draft site"}</p>
            <h1 className="font-display truncate text-xl font-bold">{site.name}</h1>
          </div>
          {preview && (
            <a href={preview} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1.5 rounded-xl border border-[#e0e7e2] bg-white px-3 py-2 text-[11px] font-bold text-[#3c4a42]">
              Visit site <ExternalLink size={12} />
            </a>
          )}
        </header>

        <nav className="mt-6 flex gap-2 overflow-auto">
          {TABS.map((entry) => (
            <Link
              key={entry.id}
              href={{ pathname: `/website/${siteId}`, query: entry.id === "pages" ? undefined : { tab: entry.id } }}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${tab === entry.id ? "bg-[#183f30] text-white" : "border border-[#dfe6e1] bg-white text-[#607168]"}`}
            >
              {entry.label}
            </Link>
          ))}
        </nav>

        {tab === "pages" && (
          <div className="mt-5 space-y-5">
            <section className="rounded-[22px] border border-[#e0e7e2] bg-white p-5 sm:p-6">
              <h2 className="font-display font-bold">Add a page</h2>
              <div className="mt-4"><CreatePageForm siteId={siteId} collections={collections} /></div>
            </section>

            <section className="overflow-hidden rounded-[22px] border border-[#e0e7e2] bg-white">
              <div className="border-b border-[#e8ece9] p-5"><h2 className="font-display font-bold">Pages</h2></div>
              {pages.length === 0 ? (
                <p className="p-6 text-xs text-[#77867d]">No pages yet.</p>
              ) : (
                <div className="divide-y divide-[#edf0ee]">
                  {pages.map((page) => (
                    <div key={page.id} className="flex flex-wrap items-center gap-3 p-4">
                      <span className="grid size-9 place-items-center rounded-xl bg-[#eef5f1] text-[#2a7657]"><FileText size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <b className="block truncate text-sm">{page.name}</b>
                        <span className="block truncate text-xs text-[#83918a]">{page.path} · {page.kind.replace("_", " ")}</span>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${page.status === "published" ? "bg-[#e6f2eb] text-[#246b4e]" : "bg-[#f2f5f3] text-[#75837b]"}`}>
                        {page.status === "published" ? "Published" : "Draft"}
                      </span>
                      <Link href={`/website/${siteId}/pages/${page.id}/edit`} className="flex items-center gap-1.5 rounded-xl border border-[#e0e7e2] px-3 py-2 text-[11px] font-bold text-[#3c4a42] hover:bg-[#f4f7f5]">
                        <Pencil size={12} /> Edit
                      </Link>
                      {page.status === "published" && (
                        <form action={unpublishPage}>
                          <input type="hidden" name="siteId" value={siteId} />
                          <input type="hidden" name="pageId" value={page.id} />
                          <SubmitButton className="rounded-xl border border-[#e0e7e2] px-3 py-2 text-[11px] font-bold text-[#66766d] hover:bg-[#f4f7f5]">Unpublish</SubmitButton>
                        </form>
                      )}
                      <form action={deletePage}>
                        <input type="hidden" name="siteId" value={siteId} />
                        <input type="hidden" name="pageId" value={page.id} />
                        <SubmitButton className="grid size-8 place-items-center rounded-xl border border-[#e0e7e2] text-[#a94f37] hover:bg-[#fff1ed]"><Trash2 size={13} /></SubmitButton>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "domains" && (
          <div className="mt-5 space-y-5">
            <section className="rounded-[22px] border border-[#e0e7e2] bg-white p-5 sm:p-6">
              <h2 className="font-display font-bold">Connect an address</h2>
              <p className="mt-1 text-xs text-[#77867d]">Point a custom domain, a subdomain, or a directory on {appHost()} at this site.</p>
              <div className="mt-4"><AddDomainForm siteId={siteId} appHost={appHost()} /></div>
            </section>

            <section className="overflow-hidden rounded-[22px] border border-[#e0e7e2] bg-white">
              <div className="border-b border-[#e8ece9] p-5"><h2 className="font-display font-bold">Connected addresses</h2></div>
              {domains.length === 0 ? (
                <p className="p-6 text-xs text-[#77867d]">Nothing points at this site yet.</p>
              ) : (
                <div className="divide-y divide-[#edf0ee]">
                  {domains.map((domain) => (
                    <div key={domain.id} className="p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl bg-[#eef5f1] text-[#2a7657]"><Globe2 size={16} /></span>
                        <div className="min-w-0 flex-1">
                          <b className="block truncate text-sm">{domainLabel(domain)}</b>
                          <span className="block text-xs capitalize text-[#83918a]">{domain.kind}{domain.is_primary ? " · primary" : ""}</span>
                        </div>
                        <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          domain.status === "verified" ? "bg-[#e6f2eb] text-[#246b4e]" : domain.status === "error" ? "bg-[#fff1ed] text-[#a94f37]" : "bg-[#fff6e6] text-[#8a6316]"}`}>
                          {domain.status === "verified" ? <CheckCircle2 size={11} /> : domain.status === "error" ? <TriangleAlert size={11} /> : <Clock3 size={11} />}
                          {domain.status}
                        </span>
                        {domain.status !== "verified" && domain.kind === "custom" && (
                          <form action={verifyDomain}>
                            <input type="hidden" name="siteId" value={siteId} />
                            <input type="hidden" name="domainId" value={domain.id} />
                            <SubmitButton className="rounded-xl border border-[#e0e7e2] px-3 py-2 text-[11px] font-bold text-[#3c4a42] hover:bg-[#f4f7f5]">Verify</SubmitButton>
                          </form>
                        )}
                        {!domain.is_primary && domain.status === "verified" && (
                          <form action={setPrimaryDomain}>
                            <input type="hidden" name="siteId" value={siteId} />
                            <input type="hidden" name="domainId" value={domain.id} />
                            <SubmitButton className="grid size-8 place-items-center rounded-xl border border-[#e0e7e2] text-[#66766d] hover:bg-[#f4f7f5]"><Star size={13} /></SubmitButton>
                          </form>
                        )}
                        <form action={removeDomain}>
                          <input type="hidden" name="siteId" value={siteId} />
                          <input type="hidden" name="domainId" value={domain.id} />
                          <SubmitButton className="grid size-8 place-items-center rounded-xl border border-[#e0e7e2] text-[#a94f37] hover:bg-[#fff1ed]"><Trash2 size={13} /></SubmitButton>
                        </form>
                      </div>
                      {domain.kind === "custom" && domain.status !== "verified" && (
                        <div className="mt-3 rounded-xl bg-[#f7faf8] p-3 text-[11px] leading-5 text-[#5f7066]">
                          Add this DNS record, then press Verify:
                          <br />
                          <code className="mt-1 block break-all font-mono text-[10px] text-[#2a6d51]">
                            TXT _commune-verify.{domain.host} → {domain.verification_token}
                          </code>
                          {domain.error_message && <span className="mt-2 block text-[#a94f37]">{domain.error_message}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "cms" && (
          <div className="mt-5 space-y-5">
            <section className="rounded-[22px] border border-[#e0e7e2] bg-white p-5 sm:p-6">
              <h2 className="font-display font-bold">Create a collection</h2>
              <p className="mt-1 text-xs text-[#77867d]">Collections hold structured content you can list on a page or render through a template.</p>
              <div className="mt-4"><CreateCollectionForm siteId={siteId} /></div>
            </section>

            <section className="overflow-hidden rounded-[22px] border border-[#e0e7e2] bg-white">
              <div className="border-b border-[#e8ece9] p-5"><h2 className="font-display font-bold">Collections</h2></div>
              {collections.length === 0 ? (
                <p className="p-6 text-xs text-[#77867d]">No collections yet.</p>
              ) : (
                <div className="divide-y divide-[#edf0ee]">
                  {collections.map((collection) => (
                    <div key={collection.id} className="flex flex-wrap items-center gap-3 p-4">
                      <span className="grid size-9 place-items-center rounded-xl bg-[#eef5f1] text-[#2a7657]"><Database size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <b className="block truncate text-sm">{collection.name}</b>
                        <span className="block text-xs text-[#83918a]">{collection.fields.length + 1} fields</span>
                      </div>
                      <Link href={`/website/${siteId}/cms/${collection.id}`} className="rounded-xl border border-[#e0e7e2] px-3 py-2 text-[11px] font-bold text-[#3c4a42] hover:bg-[#f4f7f5]">
                        Manage entries
                      </Link>
                      <form action={deleteCollection}>
                        <input type="hidden" name="siteId" value={siteId} />
                        <input type="hidden" name="collectionId" value={collection.id} />
                        <SubmitButton className="grid size-8 place-items-center rounded-xl border border-[#e0e7e2] text-[#a94f37] hover:bg-[#fff1ed]"><Trash2 size={13} /></SubmitButton>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "settings" && (
          <section className="mt-5 rounded-[22px] border border-[#e0e7e2] bg-white p-5 sm:p-6">
            <h2 className="font-display font-bold">Site settings</h2>
            <p className="mt-1 text-xs text-[#77867d]">A draft site is reachable by nobody. Publish it to serve its published pages.</p>
            <div className="mt-4"><SiteSettingsForm site={site} /></div>
          </section>
        )}
      </div>
    </main>
  );
}
