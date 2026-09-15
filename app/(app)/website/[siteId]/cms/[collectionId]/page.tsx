import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Database, Trash2 } from "lucide-react";
import { deleteEntry } from "@/app/actions/website";
import { SubmitButton } from "@/components/community/submit-button";
import { EntryForm } from "@/components/website/website-forms";
import { requireOrganizationPermission } from "@/lib/auth/dal";
import { getCollection, getSite, listEntries } from "@/lib/website/queries";

export default async function CollectionEntriesPage({ params, searchParams }: {
  params: Promise<{ siteId: string; collectionId: string }>;
  searchParams: Promise<{ entry?: string }>;
}) {
  const organization = await requireOrganizationPermission("website.manage");
  const { siteId, collectionId } = await params;

  const site = await getSite(organization.id, siteId);
  if (!site) notFound();
  const collection = await getCollection(siteId, collectionId);
  if (!collection) notFound();

  const entries = await listEntries(collectionId);
  const editingId = (await searchParams).entry;
  const editing = editingId ? entries.find((entry) => entry.id === editingId) : undefined;

  return (
    <main className="min-h-screen bg-[#f5f7f5] p-4 text-[#18251f] sm:p-7">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center gap-3">
          <Link href={{ pathname: `/website/${siteId}`, query: { tab: "cms" } }} className="grid size-9 place-items-center rounded-xl border border-[#e0e7e2] bg-white text-[#5c6d63]" aria-label="Back to collections">
            <ArrowLeft size={16} />
          </Link>
          <span className="grid size-10 place-items-center rounded-xl bg-[#183f30] text-white"><Database size={18} /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#347457]">{site.name}</p>
            <h1 className="font-display truncate text-xl font-bold">{collection.name}</h1>
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="overflow-hidden rounded-[22px] border border-[#e0e7e2] bg-white">
            <div className="border-b border-[#e8ece9] p-5">
              <h2 className="font-display font-bold">Entries</h2>
              <p className="mt-1 text-xs text-[#77867d]">Published entries appear in collection lists and template pages.</p>
            </div>
            {entries.length === 0 ? (
              <p className="p-6 text-xs text-[#77867d]">No entries yet. Create the first one on the right.</p>
            ) : (
              <div className="divide-y divide-[#edf0ee]">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-sm">{entry.title}</b>
                      <span className="block truncate text-xs text-[#83918a]">/{entry.slug}</span>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${entry.status === "published" ? "bg-[#e6f2eb] text-[#246b4e]" : "bg-[#f2f5f3] text-[#75837b]"}`}>
                      {entry.status === "published" ? "Published" : "Draft"}
                    </span>
                    <Link
                      href={{ pathname: `/website/${siteId}/cms/${collectionId}`, query: { entry: entry.id } }}
                      className="rounded-xl border border-[#e0e7e2] px-3 py-2 text-[11px] font-bold text-[#3c4a42] hover:bg-[#f4f7f5]"
                    >
                      Edit
                    </Link>
                    <form action={deleteEntry}>
                      <input type="hidden" name="siteId" value={siteId} />
                      <input type="hidden" name="entryId" value={entry.id} />
                      <SubmitButton className="grid size-8 place-items-center rounded-xl border border-[#e0e7e2] text-[#a94f37] hover:bg-[#fff1ed]"><Trash2 size={13} /></SubmitButton>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="h-fit rounded-[22px] border border-[#e0e7e2] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold">{editing ? "Edit entry" : "New entry"}</h2>
              {editing && (
                <Link href={`/website/${siteId}/cms/${collectionId}`} className="text-[11px] font-bold text-[#2a7657]">Cancel</Link>
              )}
            </div>
            <div className="mt-4">
              <EntryForm key={editing?.id ?? "new"} siteId={siteId} collection={collection} entry={editing} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
