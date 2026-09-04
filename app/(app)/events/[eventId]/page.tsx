import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, ExternalLink, MapPin, Trash2, UserRoundX, Users } from "lucide-react";
import { deleteEvent, removeEventAttendee, setEventStatus, toggleEventRegistration, updateEvent } from "@/app/actions/events";
import { SubmitButton } from "@/components/community/submit-button";
import { EventDateTimeFields } from "@/components/events/event-date-time-fields";
import { RealtimeEvents } from "@/components/events/realtime-events";
import { getActiveOrganization, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

function eventDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "full", timeStyle: "short" }).format(new Date(value));
}

function inputDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value)).replace(" ", "T");
}

function currentTimestamp() {
  return Date.now();
}

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) redirect("/onboarding");
  const canManage = ["owner", "admin"].includes(organization.role);
  const supabase = await createClient();
  const [{ data: event }, { data: spaces }, { data: registrations }] = await Promise.all([
    supabase.from("events").select("id, tenant_id, space_id, host_id, title, description, starts_at, ends_at, location_type, location_url, image_url, registration_url, capacity, status").eq("id", eventId).eq("tenant_id", organization.id).maybeSingle(),
    supabase.from("spaces").select("id, name").eq("tenant_id", organization.id).order("name"),
    supabase.from("event_rsvps").select("user_id, status, created_at").eq("event_id", eventId).eq("tenant_id", organization.id).order("created_at"),
  ]);
  if (!event) notFound();
  const going = (registrations ?? []).filter(registration=>registration.status === "going");
  const profileIds = [...new Set([event.host_id, ...going.map(registration=>registration.user_id)])];
  const { data: profiles } = await supabase.from("profiles").select("id, display_name, email").in("id", profileIds);
  const profileMap = new Map((profiles ?? []).map(profile=>[profile.id, profile]));
  const registered = going.some(registration=>registration.user_id === user.id);
  const full = event.capacity !== null && going.length >= event.capacity;
  const registrationOpen = event.status === "scheduled" && new Date(event.starts_at).valueOf() > currentTimestamp();
  const locationIsLink = event.location_url?.startsWith("https://") || event.location_url?.startsWith("http://");

  return <main className="min-h-screen bg-[#f5f7f5] p-4 text-[#18251f] sm:p-7">
    <RealtimeEvents tenantId={organization.id}/>
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center gap-3"><Link href="/events" aria-label="Back to events" className="grid size-10 place-items-center rounded-xl border border-[#dce5df] bg-white"><ArrowLeft size={16}/></Link><span className="grid size-10 place-items-center rounded-xl bg-[#183f30] text-white"><CalendarDays size={18}/></span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#397558]">Event details</p><h1 className="font-display text-xl font-bold">{event.title}</h1></div></header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-[24px] bg-[#183f30] text-white">
            {event.image_url && <div role="img" aria-label={`${event.title} event artwork`} className="h-64 bg-white bg-contain bg-center bg-no-repeat sm:h-80" style={{ backgroundImage: `url(${JSON.stringify(event.image_url)})` }}/>}<div className="p-7 sm:p-9">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide">{event.status}</span>{event.space_id && <span className="rounded-full bg-white/10 px-3 py-1 text-[10px]">{spaces?.find(space=>space.id===event.space_id)?.name}</span>}</div>
            <h2 className="font-display mt-6 text-3xl font-bold tracking-[-.04em]">{event.title}</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#c8d9d0]">{event.description || "The host has not added a description yet."}</p>
            <div className="mt-7 grid gap-3 text-sm sm:grid-cols-2"><p className="flex items-start gap-2"><Clock3 size={16} className="mt-0.5 text-[#efc77e]"/><span>{eventDate(event.starts_at)}{event.ends_at && <><br/><small className="text-[#aec6ba]">Ends {eventDate(event.ends_at)}</small></>}</span></p><p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 text-[#efc77e]"/><span className="capitalize">{event.location_type.replace("_", " ")}{event.location_url && <><br/>{locationIsLink ? <a href={event.location_url} target="_blank" rel="noreferrer" className="text-xs text-[#efc77e] underline">Open event location</a> : <small className="text-[#aec6ba]">{event.location_url}</small>}</>}</span></p></div>
            {event.registration_url && <a href={event.registration_url} target="_blank" rel="noreferrer" className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-xs font-bold text-[#183f30]">Register on the APSS website <ExternalLink size={14}/></a>}</div>
          </section>

          {canManage && <details className="rounded-[22px] border border-[#e0e7e2] bg-white p-5 sm:p-6">
            <summary className="cursor-pointer list-none font-display font-bold">Edit event</summary>
            <form action={updateEvent} className="mt-5 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="eventId" value={event.id}/>
              <label className="sm:col-span-2"><span className="mb-2 block text-xs font-semibold">Title</span><input name="title" defaultValue={event.title} required minLength={3} maxLength={160} className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label>
              <EventDateTimeFields defaultStart={inputDate(event.starts_at)} defaultEnd={inputDate(event.ends_at)}/>
              <label><span className="mb-2 block text-xs font-semibold">Location type</span><select name="locationType" defaultValue={event.location_type} className="h-11 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-sm"><option value="live_room">Circular live room</option><option value="virtual">External virtual event</option><option value="in_person">In person</option></select></label>
              <label><span className="mb-2 block text-xs font-semibold">Location or URL</span><input name="locationUrl" defaultValue={event.location_url ?? ""} maxLength={500} className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label>
              <label><span className="mb-2 block text-xs font-semibold">Cover image URL</span><input type="url" name="imageUrl" defaultValue={event.image_url ?? ""} maxLength={1000} className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label>
              <label><span className="mb-2 block text-xs font-semibold">External registration URL</span><input type="url" name="registrationUrl" defaultValue={event.registration_url ?? ""} maxLength={1000} className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label>
              <label><span className="mb-2 block text-xs font-semibold">Capacity</span><input type="number" name="capacity" defaultValue={event.capacity ?? ""} min={Math.max(1, going.length)} max={100000} className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label>
              <label><span className="mb-2 block text-xs font-semibold">Space</span><select name="spaceId" defaultValue={event.space_id ?? ""} className="h-11 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-sm"><option value="">Community-wide</option>{(spaces ?? []).map(space=><option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
              <label className="sm:col-span-2"><span className="mb-2 block text-xs font-semibold">Description</span><textarea name="description" defaultValue={event.description ?? ""} maxLength={5000} className="min-h-28 w-full rounded-xl border border-[#dce5df] p-3 text-sm"/></label>
              <input type="hidden" name="status" value={event.status === "draft" ? "draft" : "scheduled"}/>
              <div className="flex justify-end sm:col-span-2"><SubmitButton className="h-10 rounded-xl bg-[#183f30] px-5 text-xs font-semibold text-white">Save event</SubmitButton></div>
            </form>
          </details>}
        </div>

        <aside className="space-y-5">
          <section className="rounded-[22px] border border-[#e0e7e2] bg-white p-5"><div className="flex items-center gap-2"><Users size={16} className="text-[#317657]"/><h2 className="font-display font-bold">Attendance</h2></div><p className="mt-3 text-3xl font-bold">{going.length}<span className="text-sm font-medium text-[#829087]">{event.capacity ? ` / ${event.capacity}` : " going"}</span></p>{event.registration_url ? <p className="mt-4 rounded-xl bg-[#f3f5f3] p-3 text-xs leading-5 text-[#76847c]">Registration and attendance are managed by APSS. Use the registration button in the event details.</p> : registrationOpen && full && !registered ? <button disabled className="mt-5 h-11 w-full cursor-not-allowed rounded-xl bg-[#edf1ee] text-xs font-semibold text-[#7b8981]">Event is full</button> : registrationOpen ? <form action={toggleEventRegistration} className="mt-5"><input type="hidden" name="eventId" value={event.id}/><SubmitButton className={`h-11 w-full rounded-xl text-xs font-semibold ${registered ? "bg-[#edf1ee] text-[#53675b]" : "bg-[#183f30] text-white"}`}>{registered ? "Cancel registration" : "Register for event"}</SubmitButton></form> : <p className="mt-4 rounded-xl bg-[#f3f5f3] p-3 text-xs text-[#76847c]">Registration is closed.</p>}</section>

          {canManage && <section className="rounded-[22px] border border-[#e0e7e2] bg-white p-5"><h2 className="font-display font-bold">Attendees</h2><div className="mt-4 space-y-2">{going.map(registration=>{const profile=profileMap.get(registration.user_id);return <div key={registration.user_id} className="flex items-center gap-2 rounded-xl bg-[#f5f8f6] p-3"><span className="grid size-8 place-items-center rounded-full bg-white text-[9px] font-bold">{profile?.display_name?.slice(0,1).toUpperCase() ?? "M"}</span><span className="min-w-0 flex-1"><b className="block truncate text-xs">{profile?.display_name || "Member"}</b><small className="block truncate text-[#839087]">{profile?.email}</small></span><form action={removeEventAttendee}><input type="hidden" name="eventId" value={event.id}/><input type="hidden" name="userId" value={registration.user_id}/><button aria-label={`Remove ${profile?.display_name || "attendee"}`} className="grid size-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"><UserRoundX size={14}/></button></form></div>})}{!going.length && <p className="rounded-xl border border-dashed border-[#d5dfd9] p-4 text-center text-xs text-[#819087]">No registrations yet.</p>}</div></section>}

          {canManage && <section className="rounded-[22px] border border-[#eadfd9] bg-white p-5"><h2 className="font-display font-bold">Event controls</h2><div className="mt-4 grid gap-2">{event.status === "draft" && <form action={setEventStatus}><input type="hidden" name="eventId" value={event.id}/><input type="hidden" name="status" value="scheduled"/><button className="h-10 w-full rounded-xl bg-[#e8f2ec] text-xs font-semibold text-[#246749]">Publish event</button></form>}{event.status === "scheduled" && <form action={setEventStatus}><input type="hidden" name="eventId" value={event.id}/><input type="hidden" name="status" value="cancelled"/><button className="h-10 w-full rounded-xl border border-amber-200 text-xs font-semibold text-amber-700">Cancel event</button></form>}<form action={deleteEvent}><input type="hidden" name="eventId" value={event.id}/><button className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 text-xs font-semibold text-rose-700"><Trash2 size={14}/> Delete event</button></form></div></section>}
        </aside>
      </div>
    </div>
  </main>;
}
