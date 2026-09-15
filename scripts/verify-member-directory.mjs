import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase environment variables are required.");

async function connect(account) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: `${account}@commune.demo`, password: "Demo123!" });
  if (error || !data.user) throw error || new Error(`Unable to sign in ${account}.`);
  return { client, user: data.user };
}

const [{ client: owner }, { client: member, user: memberUser }, { client: guest, user: guestUser }] = await Promise.all([
  connect("owner"), connect("member"), connect("guest"),
]);
const { data: tenant, error: tenantError } = await owner.from("tenants").select("id").eq("slug", "apss").single();
if (tenantError) throw tenantError;

const [{ data: ownerDirectory, error: ownerError }, { data: memberDirectory, error: memberError }, { data: guestDirectory, error: guestError }] = await Promise.all([
  owner.rpc("get_member_directory", { check_tenant_id: tenant.id }),
  member.rpc("get_member_directory", { check_tenant_id: tenant.id }),
  guest.rpc("get_member_directory", { check_tenant_id: tenant.id }),
]);
if (ownerError || memberError || guestError) throw ownerError || memberError || guestError;
if ((ownerDirectory?.length ?? 0) < 7) throw new Error("An admin cannot see the complete APSS directory.");
if ((memberDirectory?.length ?? 0) < 6) throw new Error("A member cannot see the public APSS directory.");
if (guestDirectory?.length !== 1 || guestDirectory[0].user_id !== guestUser.id) throw new Error("Guest directory visibility is not restricted to the guest profile.");

const own = memberDirectory.find((entry) => entry.user_id === memberUser.id);
const privatePeer = memberDirectory.find((entry) => entry.display_name === "Maya Moderator");
if (!own?.email) throw new Error("Members cannot see their own email address.");
if (privatePeer?.email) throw new Error("A private member email leaked through the directory.");

const [{ data: fields, error: fieldError }, { data: tags, error: tagError }, { data: segments, error: segmentError }] = await Promise.all([
  member.from("member_profile_fields").select("field_key").eq("tenant_id", tenant.id).eq("is_active", true),
  member.from("tags").select("id, name").eq("tenant_id", tenant.id),
  owner.from("member_segments").select("id, name, criteria").eq("tenant_id", tenant.id),
]);
if (fieldError || tagError || segmentError) throw fieldError || tagError || segmentError;
if ((fields?.length ?? 0) < 3) throw new Error("Custom member fields were not seeded.");
if ((tags?.length ?? 0) < 5) throw new Error("Member tags were not seeded.");
if ((segments?.length ?? 0) < 3) throw new Error("Saved audience segments were not seeded.");

console.log(JSON.stringify({
  adminVisibleProfiles: ownerDirectory.length,
  memberVisibleProfiles: memberDirectory.length,
  guestVisibleProfiles: guestDirectory.length,
  privateEmailMasked: true,
  customFields: fields.length,
  tags: tags.length,
  savedSegments: segments.length,
}, null, 2));
