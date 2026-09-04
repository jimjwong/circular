import Link from "next/link";
import { ArrowLeft, Coffee, GraduationCap, Hand, Megaphone, MessagesSquare, Sparkles } from "lucide-react";
import { createCommunitySpaceFromTemplate } from "@/app/actions/community";
import { SubmitButton } from "@/components/community/submit-button";
import { requireOrganizationRole } from "@/lib/auth/dal";

const templates = [
  { key: "announcements", name: "Announcements", slug: "announcements", description: "Admin-led updates with member replies, compact browsing, and a warm announcement identity.", icon: Megaphone, tags: ["Admin posts", "All members", "List"] },
  { key: "introductions", name: "Introductions", slug: "introductions", description: "A welcoming feed where every member can introduce themselves and respond to newcomers.", icon: Hand, tags: ["Member posts", "Automatic", "Feed"] },
  { key: "member-lounge", name: "Member Lounge", slug: "member-lounge", description: "An opt-in, casual chat space for questions, ideas, and everyday community wins.", icon: Coffee, tags: ["Open chat", "Optional join", "Feed"] },
  { key: "course-cohort", name: "Course Cohort", slug: "course-cohort", description: "A private learning area for structured resources, instructor posts, and learner discussion.", icon: GraduationCap, tags: ["Invite only", "Instructor posts", "Cards"] },
  { key: "events-hub", name: "Events Hub", slug: "events-hub", description: "A home for event announcements, reminders, discussions, and replay links.", icon: MessagesSquare, tags: ["Admin posts", "All members", "List"] },
] as const;

export default async function SpaceTemplatesPage() {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  return <main className="min-h-screen bg-[#f5f7f5] p-4 text-[#18251f] sm:p-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-center gap-3"><Link href="/spaces" aria-label="Back to spaces" className="grid size-10 place-items-center rounded-xl border border-[#dce5df] bg-white text-[#607168]"><ArrowLeft size={16}/></Link><span className="grid size-10 place-items-center rounded-xl bg-[#183f30] text-white"><Sparkles size={17}/></span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#397558]">{organization.name}</p><h1 className="font-display text-xl font-bold">Space templates</h1></div></header>
      <section className="rounded-[24px] bg-gradient-to-br from-[#183f30] to-[#2d7658] p-6 text-white sm:p-8"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a9cfbc]">Quick setup</span><h2 className="font-display mt-2 text-2xl font-bold sm:text-3xl">Launch a proven community space in seconds.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#d0e0d8]">Each template applies its format, participation mode, posting permissions, layout, icon, and color together. You can fine-tune every setting after creation.</p></section>
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{templates.map((template) => { const Icon = template.icon; return <article key={template.key} className="flex flex-col rounded-[22px] border border-[#e0e7e2] bg-white p-5"><span className="grid size-11 place-items-center rounded-2xl bg-[#e8f2ec] text-[#286b50]"><Icon size={19}/></span><h2 className="font-display mt-4 text-lg font-bold">{template.name}</h2><p className="mt-2 flex-1 text-xs leading-5 text-[#6f7e76]">{template.description}</p><div className="mt-4 flex flex-wrap gap-1.5">{template.tags.map((tag) => <span key={tag} className="rounded-full bg-[#eef3f0] px-2 py-1 text-[9px] font-bold text-[#607168]">{tag}</span>)}</div><form action={createCommunitySpaceFromTemplate} className="mt-5 space-y-2 border-t border-[#edf1ee] pt-4"><input type="hidden" name="templateKey" value={template.key}/><label className="block"><span className="sr-only">Space name</span><input name="name" required minLength={2} maxLength={80} defaultValue={template.name} className="h-10 w-full rounded-xl border border-[#dce5df] px-3 text-xs"/></label><label className="block"><span className="sr-only">Space URL slug</span><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={template.slug} className="h-10 w-full rounded-xl border border-[#dce5df] px-3 text-xs"/></label><SubmitButton className="h-10 w-full rounded-xl bg-[#183f30] text-xs font-bold text-white">Use template</SubmitButton></form></article>; })}</section>
    </div>
  </main>;
}
