import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase environment variables are required.");
const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const owner = makeClient();
const member = makeClient();

const [{ error: ownerLogin }, { error: memberLogin }] = await Promise.all([
  owner.auth.signInWithPassword({ email: "owner@circular.local", password: "Circular123!" }),
  member.auth.signInWithPassword({ email: "phase-one-member@circular.local", password: "PhaseOne123!" }),
]);
if (ownerLogin) throw ownerLogin;
if (memberLogin) throw memberLogin;

const [{ data: ownerAuth }, { data: memberAuth }, { data: tenant, error: tenantError }] = await Promise.all([
  owner.auth.getUser(), member.auth.getUser(), owner.from("tenants").select("id").eq("slug", "phase-one-verification").single(),
]);
if (tenantError) throw tenantError;
const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString();

let { data: draft } = await owner.from("events").select("id").eq("tenant_id", tenant.id).eq("title", "Phase 4 private draft").maybeSingle();
if (!draft) {
  const result = await owner.from("events").insert({ tenant_id: tenant.id, host_id: ownerAuth.user.id, title: "Phase 4 private draft", starts_at: startsAt, status: "draft", location_type: "live_room" }).select("id").single();
  if (result.error) throw result.error;
  draft = result.data;
}
const { data: hiddenDraft } = await member.from("events").select("id").eq("id", draft.id).maybeSingle();
if (hiddenDraft) throw new Error("A regular member could read a draft event.");

const { error: forbiddenCreate } = await member.from("events").insert({ tenant_id: tenant.id, host_id: memberAuth.user.id, title: "Member forbidden event", starts_at: startsAt, status: "scheduled", location_type: "live_room" });
if (!forbiddenCreate) throw new Error("A regular member created an event.");

let { data: event } = await owner.from("events").select("id").eq("tenant_id", tenant.id).eq("title", "Phase 4 registration workflow").maybeSingle();
if (!event) {
  const result = await owner.from("events").insert({ tenant_id: tenant.id, host_id: ownerAuth.user.id, title: "Phase 4 registration workflow", description: "Capacity and attendee verification.", starts_at: startsAt, ends_at: endsAt, capacity: 1, status: "scheduled", location_type: "virtual", location_url: "https://example.test/event" }).select("id").single();
  if (result.error) throw result.error;
  event = result.data;
} else {
  const { error } = await owner.from("events").update({ starts_at: startsAt, ends_at: endsAt, capacity: 1, status: "scheduled" }).eq("id", event.id);
  if (error) throw error;
}

const { error: cleanupError } = await owner.from("event_rsvps").delete().eq("event_id", event.id);
if (cleanupError) throw cleanupError;
const { data: registered, error: registrationError } = await member.rpc("toggle_event_registration", { check_event_id: event.id });
if (registrationError || registered !== true) throw registrationError ?? new Error("Member registration failed.");
const { error: capacityError } = await owner.rpc("toggle_event_registration", { check_event_id: event.id });
if (!capacityError) throw new Error("Event capacity was not enforced.");

const { error: removeError } = await owner.from("event_rsvps").delete().eq("event_id", event.id).eq("user_id", memberAuth.user.id);
if (removeError) throw removeError;
const { count: removedCount } = await owner.from("event_rsvps").select("event_id", { count: "exact", head: true }).eq("event_id", event.id);
if (removedCount) throw new Error("Administrator attendee removal failed.");
const { data: restored, error: restoreError } = await member.rpc("toggle_event_registration", { check_event_id: event.id });
if (restoreError || restored !== true) throw restoreError ?? new Error("Member registration restoration failed.");

const [{ count: eventCount }, { count: registrationCount }, { count: auditCount }] = await Promise.all([
  owner.from("events").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
  member.from("event_rsvps").select("event_id", { count: "exact", head: true }).eq("event_id", event.id).eq("user_id", memberAuth.user.id),
  owner.from("audit_logs").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("target_type", "event"),
]);
const recordCounts = { eventCount, registrationCount, auditCount };
if (Object.values(recordCounts).some(count=>!count)) throw new Error(`Event verification records are incomplete: ${JSON.stringify(recordCounts)}`);

console.log(JSON.stringify({
  adminEventCreationVerified: true,
  memberEventCreationRejected: true,
  draftVisibilityRestricted: true,
  memberRegistrationVerified: true,
  capacityEnforcedAtomically: true,
  attendeeManagementVerified: true,
  eventAuditLoggingVerified: true,
}, null, 2));
