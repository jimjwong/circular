import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, ExternalLink, MapPin, Plus, Users } from "lucide-react";
import { createEvent, toggleEventRegistration } from "@/app/actions/events";
import { EventDateTimeFields } from "@/components/events/event-date-time-fields";
import { RealtimeEvents } from "@/components/events/realtime-events";
import { getActiveOrganization, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

function eventDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function currentTimestamp() {
  return Date.now();
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view === "past" ? "past" : "upcoming";
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) redirect("/onboarding");
  if (["suspended", "cancelled"].includes(organization.status)) redirect("/organization-unavailable");
  const canManage = ["owner", "admin"].includes(organization.role);
  const supabase = await createClient();
  const [{ data: events, error }, { data: spaces }, { data: registrations }] = await Promise.all([
    supabase.from("events").select("id, space_id, host_id, title, description, starts_at, ends_at, location_type, location_url, image_url, registration_url, capacity, status").eq("tenant_id", organization.id).order("starts_at"),
    supabase.from("spaces").select("id, name").eq("tenant_id", organization.id).order("name"),
    supabase.from("event_rsvps").select("event_id, user_id, status").eq("tenant_id", organization.id),
  ]);
  if (error) throw new Error(`Unable to load events: ${error.message}`);
  const now = currentTimestamp();
  const visibleEvents = (events ?? []).filter((event) => view === "past"
    ? new Date(event.starts_at).valueOf() < now || ["completed", "cancelled"].includes(event.status)
    : new Date(event.starts_at).valueOf() >= now && !["completed", "cancelled"].includes(event.status));
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const registration of registrations ?? []) {
    if (registration.status !== "going") continue;
    counts.set(registration.event_id, (counts.get(registration.event_id) ?? 0) + 1);
    if (registration.user_id === user.id) mine.add(registration.event_id);
  }

  return <main className="min-h-screen bg-[#f5f7f5] p-4 text-[#18251f] sm:p-7">
    <RealtimeEvents tenantId={organization.id}/>
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/dashboard" aria-label="Back to dashboard" className="grid size-10 place-items-center rounded-xl border border-[#dce5df] bg-white"><ArrowLeft size={16}/></Link>
        <span className="grid size-10 place-items-center rounded-xl bg-[#183f30] text-white"><CalendarDays size={18}/></span>
        <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#397558]">Community experiences</p><h1 className="font-display text-xl font-bold">Events</h1></div>
        <nav className="ml-auto flex rounded-xl border border-[#dce5df] bg-white p-1 text-xs font-semibold">
          <Link href="/events" className={`rounded-lg px-3 py-2 ${view === "upcoming" ? "bg-[#e8f2ec] text-[#246749]" : "text-[#718078]"}`}>Upcoming</Link>
          <Link href="/events?view=past" className={`rounded-lg px-3 py-2 ${view === "past" ? "bg-[#e8f2ec] text-[#246749]" : "text-[#718078]"}`}>Past</Link>
        </nav>
      </header>

      {canManage && <details className="mt-6 rounded-[22px] border border-[#dfe7e1] bg-white p-5 sm:p-6">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-display font-bold"><Plus size={16} className="text-[#317657]"/> Create an event</summary>
        <form action={createEvent} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="mb-2 block text-xs font-semibold">Title</span><input name="title" required minLength={3} maxLength={160} className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label>
          <EventDateTimeFields/>
          <label><span className="mb-2 block text-xs font-semibold">Location type</span><select name="locationType" className="h-11 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-sm"><option value="live_room">Circular live room</option><option value="virtual">External virtual event</option><option value="in_person">In person</option></select></label>
          <label><span className="mb-2 block text-xs font-semibold">Location or URL</span><input name="locationUrl" maxLength={500} placeholder="Meeting URL or venue" className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label>
          <label><span className="mb-2 block text-xs font-semibold">Cover image URL</span><input type="url" name="imageUrl" maxLength={1000} placeholder="https://…" className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label>
          <label><span className="mb-2 block text-xs font-semibold">External registration URL</span><input type="url" name="registrationUrl" maxLength={1000} placeholder="https://…" className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label>
          <label><span className="mb-2 block text-xs font-semibold">Capacity</span><input type="number" name="capacity" min={1} max={100000} placeholder="Unlimited" className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label>
          <label><span className="mb-2 block text-xs font-semibold">Space</span><select name="spaceId" className="h-11 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-sm"><option value="">Community-wide</option>{(spaces ?? []).map(space=><option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
          <label className="sm:col-span-2"><span className="mb-2 block text-xs font-semibold">Description</span><textarea name="description" maxLength={5000} className="min-h-28 w-full rounded-xl border border-[#dce5df] p-3 text-sm"/></label>
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><button name="status" value="draft" className="h-10 rounded-xl border border-[#dce5df] px-4 text-xs font-semibold">Save draft</button><button name="status" value="scheduled" className="h-10 rounded-xl bg-[#183f30] px-5 text-xs font-semibold text-white">Publish event</button></div>
        </form>
      </details>}

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {visibleEvents.map(event => {
          const going = counts.get(event.id) ?? 0;
          const registered = mine.has(event.id);
          const full = event.capacity !== null && going >= event.capacity;
          return <article key={event.id} className="overflow-hidden rounded-[22px] border border-[#e0e7e2] bg-white">
            {event.image_url && <Link
              href={`/events/${event.id}`}
              aria-label={`View ${event.title}`}
              className="block h-48 bg-[#edf1ee] bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${JSON.stringify(event.image_url)})` }}
            />}
            <div className="p-5"><div className="flex items-start justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${event.status === "scheduled" ? "bg-[#e8f3ed] text-[#277052]" : event.status === "draft" ? "bg-[#edf0ee] text-[#65746c]" : "bg-[#fff0e8] text-[#985f36]"}`}>{event.status}</span><span className="text-[10px] text-[#829087]">{event.space_id ? spaces?.find(space=>space.id===event.space_id)?.name : "Community-wide"}</span></div>
            <Link href={`/events/${event.id}`}><h2 className="font-display mt-4 text-lg font-bold hover:text-[#2f7758]">{event.title}</h2></Link>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#6d7c73]">{event.description || "No description added yet."}</p>
            <div className="mt-5 space-y-2 text-xs text-[#607168]"><p className="flex items-center gap-2"><Clock3 size={14}/>{eventDate(event.starts_at)}</p><p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0"/><span className="line-clamp-2">{event.location_type.replace("_", " ")}{event.location_url ? ` · ${event.location_url}` : ""}</span></p><p className="flex items-center gap-2"><Users size={14}/>{going}{event.capacity ? ` / ${event.capacity}` : ""} going</p></div>
            <div className="mt-5 flex flex-wrap gap-2"><Link href={`/events/${event.id}`} className="grid h-10 min-w-28 flex-1 place-items-center rounded-xl border border-[#dce5df] text-xs font-semibold">View details</Link>{event.registration_url ? <a href={event.registration_url} target="_blank" rel="noreferrer" className="inline-flex h-10 min-w-36 flex-1 items-center justify-center gap-2 rounded-xl bg-[#183f30] text-xs font-semibold text-white">Register with APSS <ExternalLink size={13}/></a> : event.status === "scheduled" && new Date(event.starts_at).valueOf() > now && <form action={toggleEventRegistration} className="min-w-28 flex-1"><input type="hidden" name="eventId" value={event.id}/><button disabled={!registered && full} className={`h-10 w-full rounded-xl text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${registered ? "bg-[#eef2ef] text-[#52665a]" : "bg-[#183f30] text-white"}`}>{registered ? "Cancel RSVP" : full ? "Event full" : "Register"}</button></form>}</div></div>
          </article>;
        })}
      </section>
      {!visibleEvents.length && <section className="mt-6 rounded-[22px] border border-dashed border-[#ccd9d1] bg-white p-12 text-center"><CalendarDays className="mx-auto text-[#56816c]"/><h2 className="font-display mt-4 font-bold">No {view} events</h2><p className="mt-2 text-sm text-[#7a8880]">{canManage ? "Create the first event for this workspace." : "Check back when your hosts publish something new."}</p></section>}
    </div>
  </main>;
}
