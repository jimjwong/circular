"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { updateCommunitySettings, type OrganizationActionState } from "@/app/actions/organizations";

export function CommunitySettingsForm({ name, slug, description, canManage }: { name: string; slug: string; description: string; canManage: boolean }) {
  const [state, action, pending] = useActionState<OrganizationActionState | undefined, FormData>(updateCommunitySettings, undefined);
  const currentSlug = state?.success?.match(/\/([^/.\s]+)\.?$/)?.[1] ?? slug;
  return <form action={action} className="mt-7 space-y-5">
    {!canManage && <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">Only workspace administrators can change these settings.</p>}
    <label className="block"><span className="mb-2 block text-xs font-semibold">Community name</span><input name="name" disabled={!canManage} required minLength={2} maxLength={80} defaultValue={name} className="theme-input h-11 w-full rounded-xl border px-3 text-sm outline-none disabled:opacity-60"/>{state?.errors?.name?.[0]&&<small className="mt-1 block text-rose-600">{state.errors.name[0]}</small>}</label>
    <label className="block"><span className="mb-2 block text-xs font-semibold">Community URL</span><div className="theme-border flex h-11 overflow-hidden rounded-xl border"><span className="theme-soft theme-muted grid place-items-center px-3 text-xs">localhost:3001/</span><input name="slug" disabled={!canManage} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} defaultValue={slug} className="theme-input min-w-0 flex-1 border-0 px-3 text-sm outline-none disabled:opacity-60"/></div>{state?.errors?.slug?.[0]&&<small className="mt-1 block text-rose-600">{state.errors.slug[0]}</small>}</label>
    <label className="block"><span className="mb-2 block text-xs font-semibold">Description</span><textarea name="description" disabled={!canManage} required minLength={2} maxLength={280} defaultValue={description} className="theme-input min-h-28 w-full resize-y rounded-xl border p-3 text-sm leading-6 outline-none disabled:opacity-60"/>{state?.errors?.description?.[0]&&<small className="mt-1 block text-rose-600">{state.errors.description[0]}</small>}</label>
    {state?.message&&<p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{state.message}</p>}
    {state?.success&&<div className="theme-soft theme-brand-text flex flex-wrap items-center gap-3 rounded-xl p-3 text-xs"><CheckCircle2 size={15}/><span className="flex-1">{state.success}</span><Link href={`/${currentSlug}`} className="font-bold underline">Open community</Link></div>}
    <button disabled={!canManage||pending} className="theme-primary flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-xs font-bold text-white disabled:opacity-50">{pending?<LoaderCircle className="animate-spin" size={15}/>:<Save size={15}/>}Save changes</button>
  </form>;
}
