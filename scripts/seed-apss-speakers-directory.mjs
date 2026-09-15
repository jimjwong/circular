import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const speakers = JSON.parse(readFileSync(fileURLToPath(new URL("./data/apss-speakers.json", import.meta.url)), "utf8"));

// Creates the real APSS speakers (scripts/data/apss-speakers.json, scraped from
// https://www.asiaspeakers.org/members/) as real Commune members of the 'apss' tenant —
// real auth.users, profiles, tenant_memberships, and tenant_member_profiles rows — rather
// than a standalone copy of their data. This is what makes the public website's speaker
// directory "linked to Member Management": the public listing (seed-apss-website.mjs's
// MemberDirectory block) reads these same rows live, through website_public_members(),
// and every speaker is editable the same way any other member is, at /members/manage.
//
// Re-running is safe: users are matched by email, everything else is upserted by its own
// primary key.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Supabase local environment variables are required.");
const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: tenant, error: tenantError } = await supabase.from("tenants").select("id").eq("slug", "apss").single();
if (tenantError) throw tenantError;

const { data: owner, error: ownerError } = await supabase
  .from("tenant_memberships").select("user_id").eq("tenant_id", tenant.id).eq("role", "owner").eq("status", "active").limit(1).single();
if (ownerError) throw ownerError;

// A local-only login, never shown on the public site (which only ever displays name,
// bio, photo, and categories) — the same "@commune.demo"-style convention already used
// for every other demo account in this project.
const PASSWORD = "Demo123!";

const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;

// Registers the custom field once, so the credential shows up in the internal member
// directory (/members) the same way it does on the public site — using the module's own
// extensibility mechanism rather than a bespoke column.
const { error: fieldError } = await supabase.from("member_profile_fields").upsert({
  tenant_id: tenant.id, field_key: "credential", label: "Credential", field_type: "text",
  visibility: "members", is_required: false, is_active: true, position: 0,
  updated_at: new Date().toISOString(),
}, { onConflict: "tenant_id,field_key" });
if (fieldError) throw fieldError;

let created = 0;
let updated = 0;

for (const speaker of speakers) {
  const email = `${speaker.slug}@apss.demo`;
  let user = listed.users.find((candidate) => candidate.email === email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: speaker.name },
    });
    if (error) throw error;
    user = data.user;
    listed.users.push(user);
    created += 1;
  } else {
    updated += 1;
  }

  const headline = speaker.credentials || (speaker.categories[0] ? `${speaker.categories[0]} speaker` : "APSS member");
  // Nothing is invented for a speaker with no scraped bio — a short, factual line
  // replaces it instead of a fabricated personal biography.
  const bio = speaker.bio && speaker.bio.length >= 15
    ? speaker.bio
    : "Professional member of Asia Professional Speakers Singapore.";

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id, display_name: speaker.name, email, avatar_url: speaker.photo || null,
    bio, headline, interests: speaker.categories, website_url: speaker.website || null,
    linkedin_url: speaker.linkedin || null,
    contact_email: speaker.contactEmail || null, twitter_url: speaker.twitter || null,
    youtube_url: speaker.youtube || null, facebook_url: speaker.facebook || null,
    instagram_url: speaker.instagram || null,
    timezone: "Asia/Singapore", updated_at: new Date().toISOString(),
  });
  if (profileError) throw profileError;

  const { error: membershipError } = await supabase.from("tenant_memberships").upsert({
    tenant_id: tenant.id, user_id: user.id, role: "member", membership_tier: "professional",
    status: "active", invited_by: owner.user_id, updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,user_id" });
  if (membershipError) throw membershipError;

  const { error: directoryError } = await supabase.from("tenant_member_profiles").upsert({
    tenant_id: tenant.id, user_id: user.id, directory_visibility: "public",
    custom_values: speaker.credentials ? { credential: speaker.credentials } : {},
    updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,user_id" });
  if (directoryError) throw directoryError;
}

console.log(JSON.stringify({ total: speakers.length, created, updated }, null, 2));
