"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { updateCommunitySettings, type OrganizationActionState } from "@/app/actions/organizations";

export function CommunitySettingsForm({ name, slug, description, isDiscoverable, canManage }: { name: string; slug: string; description: string; isDiscoverable: boolean; canManage: boolean }) {
  const [state, action, pending] = useActionState<OrganizationActionState | undefined, FormData>(updateCommunitySettings, undefined);
  const [discoverable, setDiscoverable] = useState(isDiscoverable);
  const currentSlug = state?.success?.match(/\/([^/.\s]+)\.?$/)?.[1] ?? slug;
  return <form action={action} className="mt-7 space-y-5">
    {!canManage && <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">Only workspace administrators can change these settings.</p>}
    <label className="block"><span className="mb-2 block text-xs font-semibold">Community name</span><input name="name" disabled={!canManage} required minLength={2} maxLength={80} defaultValue={name} className="theme-input h-11 w-full rounded-xl border px-3 text-sm outline-none disabled:opacity-60"/>{state?.errors?.name?.[0]&&<small className="mt-1 block text-rose-600">{state.errors.name[0]}</small>}</label>
    <label className="block"><span className="mb-2 block text-xs font-semibold">Community URL</span><div className="theme-border flex h-11 overflow-hidden rounded-xl border"><span className="theme-soft theme-muted grid place-items-center px-3 text-xs">/</span><input name="slug" disabled={!canManage} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} defaultValue={slug} className="theme-input min-w-0 flex-1 border-0 px-3 text-sm outline-none disabled:opacity-60"/></div>{state?.errors?.slug?.[0]&&<small className="mt-1 block text-rose-600">{state.errors.slug[0]}</small>}</label>
    <label className="block"><span className="mb-2 block text-xs font-semibold">Description</span><textarea name="description" disabled={!canManage} required minLength={2} maxLength={280} defaultValue={description} className="theme-input min-h-28 w-full resize-y rounded-xl border p-3 text-sm leading-6 outline-none disabled:opacity-60"/>{state?.errors?.description?.[0]&&<small className="mt-1 block text-rose-600">{state.errors.description[0]}</small>}</label>
    <input type="hidden" name="isDiscoverable" value={discoverable ? "true" : "false"}/>
    <div className="theme-border flex items-center justify-between rounded-2xl border p-4"><div><h3 className="text-sm font-semibold">Discoverability</h3><p className="theme-muted mt-1 text-xs">Allow this community to appear in search and discovery.</p></div><button type="button" disabled={!canManage} aria-label="Community discoverability" aria-pressed={discoverable} onClick={() => setDiscoverable((value) => !value)} className={`h-6 w-11 rounded-full p-1 transition disabled:opacity-50 ${discoverable ? "theme-primary" : "bg-[#cfd8d2]"}`}><span className={`block size-4 rounded-full bg-white transition ${discoverable ? "translate-x-5" : ""}`}/></button></div>
    {state?.message&&<p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{state.message}</p>}
    {state?.success&&<div className="theme-soft theme-brand-text flex flex-wrap items-center gap-3 rounded-xl p-3 text-xs"><CheckCircle2 size={15}/><span className="flex-1">{state.success}</span><Link href={{ pathname: `/${currentSlug}` }} className="font-bold underline">Open community</Link></div>}
    <button disabled={!canManage||pending} className="theme-primary flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-xs font-bold text-white disabled:opacity-50">{pending?<LoaderCircle className="animate-spin" size={15}/>:<Save size={15}/>}Save changes</button>
  </form>;
}
