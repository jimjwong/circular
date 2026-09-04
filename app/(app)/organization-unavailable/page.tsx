import { CircleOff } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { getActiveOrganization, verifyUser } from "@/lib/auth/dal";

export default async function OrganizationUnavailablePage() {
  await verifyUser();
  const organization = await getActiveOrganization();
  return <main className="grid min-h-screen place-items-center bg-[#f4f6f4] p-5"><div className="w-full max-w-md rounded-[26px] border border-[#e1e7e3] bg-white p-8 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff0ec] text-[#a5523d]"><CircleOff size={24}/></span><h1 className="font-display mt-5 text-2xl font-bold">Workspace unavailable</h1><p className="mt-3 text-sm leading-6 text-[#748279]">{organization?.name??"This organization"} is currently {organization?.status??"unavailable"}. Contact the organization owner or Circular support.</p><form action={signOut} className="mt-6"><button className="h-10 rounded-xl border border-[#dce4de] px-4 text-xs font-semibold">Sign out</button></form></div></main>;
}
