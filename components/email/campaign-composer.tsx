"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, LoaderCircle, Mail, Send } from "lucide-react";
import { createEmailBroadcast, type EmailActionState } from "@/app/actions/email";

const initialState: EmailActionState = { ok: false, message: "" };

export function CampaignComposer({ communityName, roles, segments }: { communityName: string; roles: { slug: string; name: string }[]; segments: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createEmailBroadcast, initialState);
  const [audiences, setAudiences] = useState(["all"]);
  const [open, setOpen] = useState(false);
  const [senderEmail, setSenderEmail] = useState("community@apss.test");

  function toggleAudience(value: string) {
    if (value === "all") return setAudiences(["all"]);
    setAudiences((current) => {
      const withoutAll = current.filter((item) => item !== "all");
      return withoutAll.includes(value) ? withoutAll.filter((item) => item !== value) : [...withoutAll, value];
    });
  }

  return <section className="rounded-[22px] border border-[#dfe7e1] bg-white">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-3 p-5 text-left sm:p-6">
      <span className="grid size-11 place-items-center rounded-2xl bg-[#e8f3ed] text-[#246c4e]"><Mail size={19}/></span>
      <span className="min-w-0 flex-1"><strong className="font-display block">Create a broadcast</strong><small className="mt-1 block text-[#74827a]">Write once, then send to membership levels, roles, or saved segments.</small></span>
      <span className="rounded-xl bg-[#183f30] px-4 py-2.5 text-xs font-bold text-white">{open ? "Close" : "New campaign"}</span>
    </button>

    {state.message && <p role="status" className={`mx-5 mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm sm:mx-6 ${state.ok ? "bg-[#eaf5ef] text-[#236a4d]" : "bg-[#fff0e8] text-[#934b2c]"}`}>{state.ok && <CheckCircle2 size={16}/>} {state.message}</p>}

    {open && <form action={action} className="grid gap-5 border-t border-[#e8ece9] p-5 sm:grid-cols-2 sm:p-6">
      <label className="sm:col-span-2"><span className="mb-2 block text-xs font-bold">Subject</span><input name="subject" required minLength={3} maxLength={200} placeholder="What should members know?" className="h-11 w-full rounded-xl border border-[#d9e3dc] px-3 text-sm outline-none focus:border-[#438069]"/></label>
      <label className="sm:col-span-2"><span className="mb-2 block text-xs font-bold">Preview text</span><input name="previewText" maxLength={240} placeholder="A short line shown beside the subject in inboxes" className="h-11 w-full rounded-xl border border-[#d9e3dc] px-3 text-sm outline-none focus:border-[#438069]"/></label>
      <label><span className="mb-2 block text-xs font-bold">Sender name</span><input name="senderName" required defaultValue={communityName} className="h-11 w-full rounded-xl border border-[#d9e3dc] px-3 text-sm"/></label>
      <label><span className="mb-2 block text-xs font-bold">Sender email</span><input type="email" name="senderEmail" required value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} className="h-11 w-full rounded-xl border border-[#d9e3dc] px-3 text-sm"/></label>
      <label className="sm:col-span-2"><span className="mb-2 block text-xs font-bold">Reply-to email <span className="font-normal text-[#849087]">(optional)</span></span><input type="email" name="replyTo" placeholder="Replies can go to your hosted mailbox" className="h-11 w-full rounded-xl border border-[#d9e3dc] px-3 text-sm"/></label>

      <fieldset className="rounded-2xl border border-[#d9e3dc] p-4 sm:col-span-2">
        <legend className="px-2 text-xs font-bold">Audience</legend>
        <p className="mb-3 text-[11px] text-[#75837b]">Membership levels, team roles, and saved member segments can be combined. Matching any selected group includes the member once.</p>
        <div className="flex flex-wrap gap-2">
          {[{ value: "all", label: "All active members" }, { value: "tier:guest", label: "Guests" }, { value: "tier:associate", label: "Associate Members" }, { value: "tier:professional", label: "Professional Members" }, { value: "tier:corporate", label: "Corporate Members" }, ...roles.map((role) => ({ value: `role:${role.slug}`, label: role.name })), ...segments.map((segment) => ({ value: `segment:${segment.id}`, label: `Segment · ${segment.name}` }))].map((option) => <label key={option.value} className={`cursor-pointer rounded-full border px-3 py-2 text-xs font-semibold transition ${audiences.includes(option.value) ? "border-[#2f7658] bg-[#eaf4ee] text-[#215d45]" : "border-[#dce4df] text-[#66766d]"}`}><input type="checkbox" name="audiences" value={option.value} checked={audiences.includes(option.value)} onChange={() => toggleAudience(option.value)} className="sr-only"/>{option.label}</label>)}
        </div>
        {!audiences.length && <p className="mt-3 text-xs font-semibold text-[#a24f31]">Choose at least one group.</p>}
      </fieldset>

      <label className="sm:col-span-2"><span className="mb-2 block text-xs font-bold">Message</span><textarea name="body" required minLength={10} rows={10} placeholder={`Hello {{ .Subscriber.Name }},\n\nShare your update with the ${communityName} community.`} className="w-full rounded-2xl border border-[#d9e3dc] p-4 text-sm leading-6 outline-none focus:border-[#438069]"/><span className="mt-2 block text-[11px] text-[#7b8981]">Plain text is safely converted into a responsive email. listmonk personalization tags are supported.</span></label>

      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
        <button name="intent" value="draft" disabled={pending || !audiences.length} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d8e1db] px-5 text-xs font-bold disabled:opacity-50">{pending && <LoaderCircle className="animate-spin" size={15}/>} Save draft</button>
        <button name="intent" value="send" disabled={pending || !audiences.length} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#183f30] px-5 text-xs font-bold text-white disabled:opacity-50"><Send size={15}/> Queue campaign</button>
      </div>
    </form>}
  </section>;
}
