"use client";

import { useActionState, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { createOrganization } from "@/app/actions/organizations";
import type { AuthState } from "@/lib/auth/types";

export function OnboardingForm() {
  const [state, action, pending] = useActionState<AuthState | undefined, FormData>(createOrganization, undefined);
  const [name, setName] = useState("");
  const suggestedSlug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return <form action={action} className="mt-8 space-y-5">
    <label className="block"><span className="mb-2 block text-xs font-semibold">Organization name</span><input autoFocus required name="name" value={name} onChange={(event)=>setName(event.target.value)} placeholder="Acme Community" className="h-11 w-full rounded-xl border border-[#dbe3de] px-3 text-sm outline-none focus:border-[#73aa90] focus:ring-2 focus:ring-[#dceee5]"/>{state?.errors?.name?.[0]&&<span className="mt-1 block text-xs text-[#ae523e]">{state.errors.name[0]}</span>}</label>
    <label className="block"><span className="mb-2 block text-xs font-semibold">Workspace URL</span><div className="flex h-11 overflow-hidden rounded-xl border border-[#dbe3de] focus-within:border-[#73aa90] focus-within:ring-2 focus-within:ring-[#dceee5]"><span className="grid place-items-center bg-[#f2f5f3] px-3 text-xs text-[#7f8d85]">circular.local/</span><input required name="slug" key={suggestedSlug} defaultValue={suggestedSlug} placeholder="acme-community" className="min-w-0 flex-1 px-3 text-sm outline-none"/></div>{state?.errors?.slug?.[0]&&<span className="mt-1 block text-xs text-[#ae523e]">{state.errors.slug[0]}</span>}</label>
    {state?.message&&<p role="alert" className="rounded-xl bg-[#fff1ed] px-3 py-2.5 text-xs text-[#a94f37]">{state.message}</p>}
    <button disabled={pending} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#183f30] text-sm font-bold text-white disabled:opacity-60">{pending?<LoaderCircle className="animate-spin" size={16}/>:<>Create workspace <ArrowRight size={15}/></>}</button>
  </form>;
}
