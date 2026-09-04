import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Compass, MapPin, Sparkles, Tags, UserRoundPlus } from "lucide-react";
import { publishMemberIntroduction } from "@/app/actions/community";
import { SubmitButton } from "@/components/community/submit-button";
import { getActiveOrganization, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export default async function IntroducePage() {
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) redirect("/onboarding");
  if (!["trial", "active"].includes(organization.status)) redirect("/organization-unavailable");

  const supabase = await createClient();
  const [{ data: profile, error: profileError }, { data: onboarding }] = await Promise.all([
    supabase.from("profiles").select("display_name, headline, location, bio, interests").eq("id", user.id).maybeSingle(),
    supabase.from("member_onboarding").select("introduction_post_id, completed_at").eq("tenant_id", organization.id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (profileError) throw new Error(profileError.message);

  return <main className="min-h-screen bg-[#f3f6f4] px-4 py-6 text-[#18251f] sm:px-7 sm:py-10">
    <div className="mx-auto max-w-5xl">
      <header className="flex items-center gap-3"><Link href="/community" className="grid size-10 place-items-center rounded-xl border border-[#dce5df] bg-white text-[#607168]"><ArrowLeft size={16}/></Link><span className="grid size-10 place-items-center rounded-xl bg-[#183f30] text-white"><UserRoundPlus size={18}/></span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#397558]">Member onboarding</p><h1 className="font-display text-xl font-bold">{onboarding?.completed_at ? "Update your introduction" : "Introduce yourself"}</h1></div></header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <section className="rounded-[24px] border border-[#dfe7e2] bg-white p-5 shadow-[0_14px_40px_rgba(31,58,45,.06)] sm:p-8">
          <div className="rounded-2xl bg-gradient-to-br from-[#e8f4ed] to-[#f5eadb] p-5"><Sparkles size={20} className="text-[#2b7455]"/><h2 className="font-display mt-3 text-2xl font-bold tracking-[-.03em]">Give people an easy way to welcome you.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#607168]">Your answers update your member profile and create a real post in the Introductions space. Members can reply and react immediately.</p></div>

          <form action={publishMemberIntroduction} className="mt-7 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Your name" name="displayName" defaultValue={profile?.display_name ?? user.displayName} placeholder="Morgan Lee" maxLength={80}/><Field label="What you do" name="headline" defaultValue={profile?.headline ?? ""} placeholder="Independent product designer" maxLength={100}/></div>
            <label className="block"><span className="mb-2 flex items-center gap-2 text-xs font-semibold"><MapPin size={13} className="text-[#438065]"/>Location <small className="font-normal text-[#8a968f]">optional</small></span><input name="location" defaultValue={profile?.location ?? ""} maxLength={80} placeholder="Singapore" className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm outline-none focus:border-[#74a98f] focus:ring-2 focus:ring-[#dceee5]"/></label>
            <label className="block"><span className="mb-2 block text-xs font-semibold">Tell us a little about yourself</span><textarea name="bio" required minLength={20} maxLength={1000} defaultValue={profile?.bio ?? ""} placeholder="Share your background, what you are working on, and something people can ask you about." className="min-h-32 w-full resize-y rounded-xl border border-[#dce5df] p-3 text-sm leading-6 outline-none focus:border-[#74a98f] focus:ring-2 focus:ring-[#dceee5]"/><small className="mt-1.5 block text-[10px] text-[#89958e]">A few thoughtful sentences make it easier for members to start a conversation.</small></label>
            <label className="block"><span className="mb-2 flex items-center gap-2 text-xs font-semibold"><Compass size={13} className="text-[#438065]"/>What do you hope to get from this community?</span><textarea name="goal" required minLength={10} maxLength={500} placeholder="I would love to meet… / I need help with… / I can contribute…" className="min-h-24 w-full resize-y rounded-xl border border-[#dce5df] p-3 text-sm leading-6 outline-none focus:border-[#74a98f] focus:ring-2 focus:ring-[#dceee5]"/></label>
            <label className="block"><span className="mb-2 flex items-center gap-2 text-xs font-semibold"><Tags size={13} className="text-[#438065]"/>Interests <small className="font-normal text-[#8a968f]">separate with commas</small></span><input name="interests" defaultValue={(profile?.interests ?? []).join(", ")} maxLength={240} placeholder="Community building, design, creator business" className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm outline-none focus:border-[#74a98f] focus:ring-2 focus:ring-[#dceee5]"/></label>
            <div className="flex flex-col-reverse gap-3 border-t border-[#edf1ee] pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-5 text-[#7e8b83]">You can edit this later. Existing replies and reactions stay attached.</p><SubmitButton className="h-11 rounded-xl bg-[#183f30] px-6 text-xs font-bold text-white shadow-[0_8px_20px_rgba(24,63,48,.18)]">{onboarding?.completed_at ? "Save introduction" : "Publish introduction"}</SubmitButton></div>
          </form>
        </section>

        <aside className="space-y-4"><section className="rounded-[22px] border border-[#dfe7e2] bg-white p-5"><h2 className="font-display font-bold">Your first wins</h2><div className="mt-4 space-y-3">{["Complete your profile", "Publish your introduction", "Receive your first welcome", "Join a conversation"].map((item, index) => <div key={item} className="flex items-center gap-3"><span className={`grid size-7 place-items-center rounded-full ${onboarding?.completed_at || index === 0 ? "bg-[#dff0e6] text-[#287052]" : "bg-[#f0f3f1] text-[#9aa49e]"}`}><CheckCircle2 size={14}/></span><span className="text-xs font-medium text-[#56685e]">{item}</span></div>)}</div></section><section className="rounded-[22px] bg-[#183f30] p-5 text-white"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#9fc6b3]">Investor demo tip</span><h3 className="font-display mt-3 font-bold">This is connected, not staged.</h3><p className="mt-2 text-xs leading-5 text-[#c5d8cf]">Publishing here creates tenant-safe community data and activates the same comments, reactions, moderation, and notifications used everywhere else.</p></section></aside>
      </div>
    </div>
  </main>;
}

function Field({ label, name, defaultValue, placeholder, maxLength }: { label: string; name: string; defaultValue: string; placeholder: string; maxLength: number }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold">{label}</span><input name={name} required minLength={2} maxLength={maxLength} defaultValue={defaultValue} placeholder={placeholder} className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm outline-none focus:border-[#74a98f] focus:ring-2 focus:ring-[#dceee5]"/></label>;
}
