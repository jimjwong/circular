"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { addDomain, createCollection, createPage, createSite, saveEntry, updateSite } from "@/app/actions/website";
import type { WebsiteActionState } from "@/app/actions/website";
import type { WebsiteCollection, WebsiteCollectionEntryRow } from "@/lib/website/queries";
import { PAGE_TEMPLATES } from "@/lib/website/templates";

const field = "w-full rounded-xl border border-[#dce5df] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b9d8c8]";
const label = "mb-1.5 block text-xs font-semibold text-[#4c5a52]";
const primary = "flex h-10 items-center justify-center gap-2 rounded-xl bg-[#183f30] px-4 text-xs font-bold text-white transition hover:bg-[#245841] disabled:opacity-60";

function Feedback({ state }: { state: WebsiteActionState | undefined }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-xs ${state.ok ? "bg-[#eaf5ef] text-[#246b4e]" : "bg-[#fff1ed] text-[#a94f37]"}`}>
      {state.message}
    </p>
  );
}

function slugify(value: string) {
  return value.toLowerCase().trim().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "").slice(0, 60);
}

export function CreateSiteForm() {
  const [state, action, pending] = useActionState<WebsiteActionState | undefined, FormData>(createSite, undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className={label}>Site name</span>
        <input
          className={field} name="name" required minLength={2} maxLength={120} value={name} placeholder="Marketing site"
          onChange={(event) => { setName(event.target.value); if (!touched) setSlug(slugify(event.target.value)); }}
        />
      </label>
      <label className="block">
        <span className={label}>Address</span>
        <input
          className={field} name="slug" required pattern="[a-z0-9-]+" value={slug} placeholder="marketing"
          onChange={(event) => { setTouched(true); setSlug(slugify(event.target.value)); }}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>Description</span>
        <input className={field} name="description" maxLength={400} placeholder="What this site is for" />
      </label>
      <div className="sm:col-span-2"><Feedback state={state} /></div>
      <div className="sm:col-span-2">
        <button className={primary} disabled={pending}><Plus size={14} /> Create site</button>
      </div>
    </form>
  );
}

export function SiteSettingsForm({ site }: { site: { id: string; name: string; description: string | null; status: string } }) {
  const [state, action, pending] = useActionState<WebsiteActionState | undefined, FormData>(updateSite, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-end">
      <input type="hidden" name="siteId" value={site.id} />
      <label className="block">
        <span className={label}>Site name</span>
        <input className={field} name="name" required defaultValue={site.name} maxLength={120} />
      </label>
      <label className="block">
        <span className={label}>Visibility</span>
        <select className={field} name="status" defaultValue={site.status}>
          <option value="draft">Draft — private</option>
          <option value="published">Published — live</option>
        </select>
      </label>
      <button className={primary} disabled={pending}>Save</button>
      <input type="hidden" name="description" value={site.description ?? ""} />
      <div className="sm:col-span-3"><Feedback state={state} /></div>
    </form>
  );
}

export function CreatePageForm({ siteId, collections }: { siteId: string; collections: WebsiteCollection[] }) {
  const [state, action, pending] = useActionState<WebsiteActionState | undefined, FormData>(createPage, undefined);
  const [template, setTemplate] = useState<keyof typeof PAGE_TEMPLATES>("landing");
  const isTemplate = template === "collection";

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="siteId" value={siteId} />
      <label className="block">
        <span className={label}>Page name</span>
        <input className={field} name="name" required maxLength={160} placeholder="About" />
      </label>
      <label className="block">
        <span className={label}>Path</span>
        <input className={field} name="path" required defaultValue="/" placeholder={isTemplate ? "/blog/:slug" : "/about"} />
      </label>
      <label className="block">
        <span className={label}>Start from</span>
        <select className={field} name="template" value={template} onChange={(event) => setTemplate(event.target.value as keyof typeof PAGE_TEMPLATES)}>
          {Object.entries(PAGE_TEMPLATES).map(([id, entry]) => <option key={id} value={id}>{entry.label}</option>)}
        </select>
      </label>
      {isTemplate && (
        <label className="block">
          <span className={label}>Collection</span>
          <select className={field} name="collectionId" required>
            <option value="">Choose a collection</option>
            {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
          </select>
        </label>
      )}
      <p className="text-xs leading-5 text-[#77867d] sm:col-span-2">{PAGE_TEMPLATES[template].description}</p>
      <div className="sm:col-span-2"><Feedback state={state} /></div>
      <div className="sm:col-span-2"><button className={primary} disabled={pending}><Plus size={14} /> Add page</button></div>
    </form>
  );
}

export function AddDomainForm({ siteId, appHost }: { siteId: string; appHost: string }) {
  const [state, action, pending] = useActionState<WebsiteActionState | undefined, FormData>(addDomain, undefined);
  const [kind, setKind] = useState("subdomain");

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[170px_minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="siteId" value={siteId} />
      <label className="block">
        <span className={label}>Type</span>
        <select className={field} name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="subdomain">Subdomain</option>
          <option value="custom">Custom domain</option>
          <option value="directory">Directory</option>
        </select>
      </label>
      {kind === "directory" ? (
        <label className="block">
          <span className={label}>Directory</span>
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs text-[#83918a]">{appHost}/</span>
            <input className={field} name="basePath" required pattern="[a-z0-9-]+" placeholder="acme" />
          </div>
        </label>
      ) : (
        <label className="block">
          <span className={label}>{kind === "subdomain" ? "Subdomain host" : "Domain"}</span>
          <input className={field} name="host" required placeholder={kind === "subdomain" ? `acme.${appHost}` : "www.example.com"} />
        </label>
      )}
      <button className={primary} disabled={pending}><Plus size={14} /> Connect</button>
      <div className="sm:col-span-3"><Feedback state={state} /></div>
      {kind === "custom" && (
        <p className="text-xs leading-5 text-[#77867d] sm:col-span-3">
          After adding the domain, create a <b>TXT</b> record at <code>_commune-verify.&lt;your-domain&gt;</code> containing the
          verification token shown below, point the host at this application, then press Verify.
        </p>
      )}
    </form>
  );
}

export function CreateCollectionForm({ siteId }: { siteId: string }) {
  const [state, action, pending] = useActionState<WebsiteActionState | undefined, FormData>(createCollection, undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="siteId" value={siteId} />
      <label className="block">
        <span className={label}>Collection name</span>
        <input
          className={field} name="name" required maxLength={120} value={name} placeholder="Blog posts"
          onChange={(event) => { setName(event.target.value); if (!touched) setSlug(slugify(event.target.value)); }}
        />
      </label>
      <label className="block">
        <span className={label}>Address</span>
        <input className={field} name="slug" required pattern="[a-z0-9-]+" value={slug} placeholder="blog-posts"
          onChange={(event) => { setTouched(true); setSlug(slugify(event.target.value)); }} />
      </label>
      <button className={primary} disabled={pending}><Plus size={14} /> Create</button>
      <div className="sm:col-span-3"><Feedback state={state} /></div>
    </form>
  );
}

export function EntryForm({ siteId, collection, entry }: {
  siteId: string;
  collection: WebsiteCollection;
  entry?: WebsiteCollectionEntryRow;
}) {
  const [state, action, pending] = useActionState<WebsiteActionState | undefined, FormData>(saveEntry, undefined);
  const [title, setTitle] = useState(entry?.title ?? "");
  const [slug, setSlug] = useState(entry?.slug ?? "");
  const [touched, setTouched] = useState(Boolean(entry));

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="collectionId" value={collection.id} />
      {entry && <input type="hidden" name="entryId" value={entry.id} />}
      <label className="block">
        <span className={label}>Title</span>
        <input className={field} name="title" required maxLength={200} value={title}
          onChange={(event) => { setTitle(event.target.value); if (!touched) setSlug(slugify(event.target.value)); }} />
      </label>
      <label className="block">
        <span className={label}>Address</span>
        <input className={field} name="slug" required pattern="[a-z0-9-]+" value={slug}
          onChange={(event) => { setTouched(true); setSlug(slugify(event.target.value)); }} />
      </label>

      {collection.fields.map((entryField) => (
        <label key={entryField.key} className={entryField.type === "textarea" ? "block sm:col-span-2" : "block"}>
          <span className={label}>{entryField.label}</span>
          {entryField.type === "textarea"
            ? <textarea className={`${field} min-h-32`} name={`field.${entryField.key}`} defaultValue={String(entry?.data?.[entryField.key] ?? "")} />
            : entryField.type === "boolean"
              ? <input type="checkbox" name={`field.${entryField.key}`} defaultChecked={entry?.data?.[entryField.key] === true} />
              : <input className={field} type={entryField.type === "number" ? "number" : entryField.type === "url" ? "url" : entryField.type === "date" ? "date" : "text"}
                  name={`field.${entryField.key}`} defaultValue={String(entry?.data?.[entryField.key] ?? "")} />}
        </label>
      ))}

      <label className="block">
        <span className={label}>Status</span>
        <select className={field} name="status" defaultValue={entry?.status ?? "draft"}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>
      <div className="sm:col-span-2"><Feedback state={state} /></div>
      <div className="sm:col-span-2"><button className={primary} disabled={pending}>{entry ? "Save entry" : "Create entry"}</button></div>
    </form>
  );
}
