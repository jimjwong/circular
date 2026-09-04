"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActiveOrganization, requireOrganizationRole, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const capacitySchema = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.coerce.number().int().min(1).max(100000).optional(),
);

const eventSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(5000).optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  locationType: z.enum(["live_room", "virtual", "in_person"]),
  locationUrl: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().url().max(1000).optional(),
  registrationUrl: z.string().trim().url().max(1000).optional(),
  hiddenRoles: z.array(z.enum(["moderator", "member"])).default([]),
  capacity: capacitySchema,
  status: z.enum(["draft", "scheduled"]),
  spaceId: z.string().uuid().optional(),
});

function eventPath(eventId: string) {
  return `/events/${eventId}` as Route;
}

function parseEvent(formData: FormData) {
  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt") || undefined,
    locationType: formData.get("locationType"),
    locationUrl: formData.get("locationUrl") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    registrationUrl: formData.get("registrationUrl") || undefined,
    hiddenRoles: formData.getAll("hiddenRoles"),
    capacity: formData.get("capacity"),
    status: formData.get("status"),
    spaceId: formData.get("spaceId") || undefined,
  });
  if (!parsed.success) throw new Error("Enter valid event details.");
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  if (Number.isNaN(startsAt.valueOf()) || (endsAt && Number.isNaN(endsAt.valueOf()))) throw new Error("Enter valid event dates.");
  if (endsAt && endsAt < startsAt) throw new Error("The event cannot end before it starts.");
  return { ...parsed.data, startsAt: startsAt.toISOString(), endsAt: endsAt?.toISOString() ?? null };
}

export async function createEvent(formData: FormData) {
  const [user, organization] = await Promise.all([verifyUser(), requireOrganizationRole(["owner", "admin"])]);
  if (!["trial", "active"].includes(organization.status)) throw new Error("This organization cannot create events.");
  const event = parseEvent(formData);
  const supabase = await createClient();
  if (event.spaceId) {
    const { data: space } = await supabase.from("spaces").select("id").eq("id", event.spaceId).eq("tenant_id", organization.id).maybeSingle();
    if (!space) throw new Error("The selected space is unavailable.");
  }
  const { data, error } = await supabase.from("events").insert({
    tenant_id: organization.id,
    host_id: user.id,
    space_id: event.spaceId ?? null,
    title: event.title,
    description: event.description ?? null,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    location_type: event.locationType,
    location_url: event.locationUrl ?? null,
    image_url: event.imageUrl ?? null,
    registration_url: event.registrationUrl ?? null,
    hidden_roles: event.hiddenRoles,
    capacity: event.capacity ?? null,
    status: event.status,
  }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect(eventPath(data.id));
}

export async function updateEvent(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const eventId = z.string().uuid().parse(formData.get("eventId"));
  const event = parseEvent(formData);
  const supabase = await createClient();
  if (event.spaceId) {
    const { data: space } = await supabase.from("spaces").select("id").eq("id", event.spaceId).eq("tenant_id", organization.id).maybeSingle();
    if (!space) throw new Error("The selected space is unavailable.");
  }
  const { error } = await supabase.from("events").update({
    space_id: event.spaceId ?? null,
    title: event.title,
    description: event.description ?? null,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    location_type: event.locationType,
    location_url: event.locationUrl ?? null,
    image_url: event.imageUrl ?? null,
    registration_url: event.registrationUrl ?? null,
    hidden_roles: event.hiddenRoles,
    capacity: event.capacity ?? null,
    status: event.status,
    updated_at: new Date().toISOString(),
  }).eq("id", eventId).eq("tenant_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/events");
  revalidatePath(eventPath(eventId));
}

export async function setEventStatus(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const eventId = z.string().uuid().parse(formData.get("eventId"));
  const status = z.enum(["draft", "scheduled", "cancelled", "completed"]).parse(formData.get("status"));
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ status, updated_at: new Date().toISOString() }).eq("id", eventId).eq("tenant_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/events");
  revalidatePath(eventPath(eventId));
}

export async function deleteEvent(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const eventId = z.string().uuid().parse(formData.get("eventId"));
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId).eq("tenant_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect("/events");
}

export async function toggleEventRegistration(formData: FormData) {
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) throw new Error("Choose an organization first.");
  const eventId = z.string().uuid().parse(formData.get("eventId"));
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id").eq("id", eventId).eq("tenant_id", organization.id).maybeSingle();
  if (!event) throw new Error("The event is unavailable.");
  const { error } = await supabase.rpc("toggle_event_registration", { check_event_id: eventId });
  if (error) throw new Error(error.message);
  revalidatePath("/events");
  revalidatePath(eventPath(eventId));
  void user;
}

export async function removeEventAttendee(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const eventId = z.string().uuid().parse(formData.get("eventId"));
  const userId = z.string().uuid().parse(formData.get("userId"));
  const supabase = await createClient();
  const { error } = await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("tenant_id", organization.id).eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/events");
  revalidatePath(eventPath(eventId));
}
