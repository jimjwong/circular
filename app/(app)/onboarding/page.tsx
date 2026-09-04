import { redirect } from "next/navigation";
import { Building2, Check } from "lucide-react";
import { getOrganizations, verifyUser } from "@/lib/auth/dal";
import { OnboardingForm } from "@/components/organizations/onboarding-form";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await verifyUser();
  const organizations = await getOrganizations();
  const { new: createAnother } = await searchParams;
  if (organizations.length && createAnother !== "1") redirect("/dashboard");

  return <main className="grid min-h-screen place-items-center bg-[#f3f6f4] p-5"><div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-[#e1e7e3] bg-white shadow-[0_20px_60px_rgba(24,55,42,.08)]"><div className="grid md:grid-cols-[.82fr_1.18fr]"><aside className="bg-[#183f30] p-7 text-white sm:p-9"><span className="grid size-11 place-items-center rounded-2xl bg-white/10"><Building2 size={20}/></span><h2 className="font-display mt-7 text-2xl font-bold">Your organization is the secure boundary.</h2><p className="mt-3 text-sm leading-6 text-[#bed1c7]">Members, content, billing, and settings remain isolated from every other workspace.</p><div className="mt-8 space-y-3">{["You become the organization owner","Invite admins, moderators, and members","Switch between organizations anytime"].map(item=><div key={item} className="flex gap-2 text-xs text-[#d8e4de]"><Check className="mt-0.5 shrink-0 text-[#edc577]" size={14}/>{item}</div>)}</div></aside><section className="p-7 sm:p-10"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#347457]">Welcome, {user.displayName}</span><h1 className="font-display mt-2 text-3xl font-bold tracking-[-.04em]">Create your first workspace</h1><p className="mt-3 text-sm leading-6 text-[#75837b]">Choose a name and URL. Both can be adjusted later.</p><OnboardingForm/></section></div></div></main>;
}
