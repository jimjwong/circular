import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Supabase local environment variables are required.");

const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: tenant, error: tenantError } = await supabase.from("tenants").select("id").eq("slug", "creator-collective-demo").single();
if (tenantError) throw tenantError;
const { data: adminMembership, error: adminError } = await supabase.from("tenant_memberships").select("user_id").eq("tenant_id", tenant.id).eq("role", "owner").eq("status", "active").limit(1).single();
if (adminError) throw adminError;

const events = [
  {
    title: "APSS Keynote Lab",
    description: "A practical APSS keynote development lab for professional speakers. Early-bird registration is SGD 60 for APSS members and SGD 110 for non-members.",
    starts_at: "2026-09-22T18:00:00+08:00",
    ends_at: "2026-09-22T21:30:00+08:00",
    location_url: "Sheraton Towers Singapore, 39 Scotts Road, Singapore 228230",
    image_url: "https://www.asiaspeakers.org/wp-content/uploads/2026/08/Keynote-Speakers-22-Sep.jpg",
    registration_url: "https://my.asiaspeakers.org/event-6777992",
  },
  {
    title: "APSS SIG – Coaching Club",
    description: "A members-only peer-sharing session for speakers who include coaching in their business. Bring a challenge, exchange practical ideas, connect with fellow coaches, and leave with a fresh action to take.",
    starts_at: "2026-09-25T10:00:00+08:00",
    ends_at: "2026-09-25T12:00:00+08:00",
    location_url: "Just BrewIN, 452 Race Course Road, Singapore 218696",
    image_url: "https://www.asiaspeakers.org/wp-content/uploads/2026/07/Coaching-Club-25-Sep.jpg",
    registration_url: "https://my.asiaspeakers.org/event-6691560",
  },
  {
    title: "Professional Development Weekend 2026",
    description: "A two-day APSS professional development experience at Changi Cove. Published special pricing is SGD 399 for eligible APSS and Global Speakers Federation members.",
    starts_at: "2026-10-03T09:00:00+08:00",
    ends_at: "2026-10-04T18:00:00+08:00",
    location_url: "Changi Cove, 351 Cranwell Road, Singapore 509866",
    image_url: "https://www.asiaspeakers.org/wp-content/uploads/2026/08/PDW-2026-Poster-with-QR-Code.jpg",
    registration_url: "https://my.asiaspeakers.org/event-6773694",
  },
  {
    title: "APSS Convention 2027: EVOLVE",
    description: "The APSS Convention returns with Preconvention, the CSP Summit, gala, and two convention days. Standard and limited VIP experiences are available, with Dr. Damini Chawla serving as Convention Chair.",
    starts_at: "2027-04-30T09:00:00+08:00",
    ends_at: "2027-05-01T17:00:00+08:00",
    location_url: "One Farrer Hotel, 1 Farrer Park Station Road, Singapore 217562",
    image_url: "https://www.asiaspeakers.org/wp-content/uploads/2026/08/Event-Banner-for-APSS-website-21.png",
    registration_url: "https://apssconvention2027.asiaspeakers.org/sales-page",
  },
];

for (const event of events) {
  const values = { tenant_id: tenant.id, host_id: adminMembership.user_id, location_type: "in_person", capacity: null, status: "scheduled", ...event };
  const { data: existing, error: readError } = await supabase.from("events").select("id").eq("tenant_id", tenant.id).eq("title", event.title).maybeSingle();
  if (readError) throw readError;
  const result = existing
    ? await supabase.from("events").update({ ...values, updated_at: new Date().toISOString() }).eq("id", existing.id)
    : await supabase.from("events").insert(values);
  if (result.error) throw result.error;
}

console.log(JSON.stringify({ imported: events.length, tenant: "Creator Collective Demo", source: "https://www.asiaspeakers.org/events/" }, null, 2));
