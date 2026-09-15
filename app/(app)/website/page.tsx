import Link from "next/link";
import { ArrowLeft, Globe2, LayoutTemplate, PlusCircle } from "lucide-react";
import { requireOrganizationPermission } from "@/lib/auth/dal";
import { CreateSiteForm } from "@/components/website/website-forms";
import { listSites } from "@/lib/website/queries";

export default async function WebsitePage() {
  const organization = await requireOrganizationPermission("website.manage");
  const sites = await listSites(organization.id);

  return (
    <main className="min-h-screen bg-[#f5f7f5] p-4 text-[#18251f] sm:p-7">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className="grid size-9 place-items-center rounded-xl border border-[#e0e7e2] bg-white text-[#5c6d63]" aria-label="Back to dashboard">
            <ArrowLeft size={16} />
          </Link>
          <span className="grid size-10 place-items-center rounded-xl bg-[#183f30] text-white"><Globe2 size={18} /></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#347457]">Grow</p>
            <h1 className="font-display text-xl font-bold">Websites</h1>
          </div>
        </header>

        <section className="mt-6 rounded-[22px] border border-[#e0e7e2] bg-white p-5 sm:p-6">
          <h2 className="font-display font-bold">Create a website</h2>
          <p className="mt-1 text-xs text-[#77867d]">Build marketing sites, landing pages, event pages, and funnels with drag and drop.</p>
          <div className="mt-5"><CreateSiteForm /></div>
        </section>

        <section className="mt-5">
          <h2 className="font-display mb-3 font-bold">Your sites</h2>
          {sites.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[#cfdad4] bg-white p-10 text-center">
              <LayoutTemplate className="mx-auto text-[#9aa59e]" size={26} />
              <p className="mt-3 text-sm font-semibold">No sites yet</p>
              <p className="mt-1 text-xs text-[#77867d]">Create your first site above to start building pages.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sites.map((site) => (
                <Link
                  key={site.id}
                  href={`/website/${site.id}`}
                  className="group rounded-[20px] border border-[#e3e9e5] bg-white p-5 transition hover:border-[#a9c8b8]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-[#eef5f1] text-[#2a7657]"><Globe2 size={18} /></span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${site.status === "published" ? "bg-[#e6f2eb] text-[#246b4e]" : "bg-[#f2f5f3] text-[#75837b]"}`}>
                      {site.status === "published" ? "Live" : "Draft"}
                    </span>
                  </div>
                  <b className="font-display mt-4 block">{site.name}</b>
                  <span className="mt-1 block text-xs text-[#77867d]">{site.description || `/${site.slug}`}</span>
                  <span className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-[#2a7657]">
                    <PlusCircle size={13} /> Open builder
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
