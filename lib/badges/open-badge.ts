import { createHash, createPrivateKey, sign } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

export async function signBadgeAward(admin: SupabaseClient, awardId: string) {
  const { data: award, error } = await admin.from("course_badge_awards").select("id, badge_id, course_id, user_id, verification_id, recipient_name, awarded_at, revoked").eq("id", awardId).single();
  if (error) throw error;
  const [{ data: badge }, { data: course }, { data: profile }] = await Promise.all([
    admin.from("course_badges").select("id, name, description, image_url, criteria_text").eq("id", award.badge_id).single(),
    admin.from("courses").select("id, title, slug, cpd_hours_total").eq("id", award.course_id).single(),
    admin.from("profiles").select("email").eq("id", award.user_id).single(),
  ]);
  if (!badge || !course || !profile?.email) throw new Error("Badge credential data is incomplete.");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const salt = award.verification_id.replaceAll("-", "").slice(0, 16);
  const identityHash = createHash("sha256").update(`${salt}${profile.email.trim().toLowerCase()}`).digest("hex");
  const credential = {
    "@context": ["https://www.w3.org/ns/credentials/v2", "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"],
    id: `${siteUrl}/api/badges/verify/${award.verification_id}`,
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    issuer: { id: `${siteUrl}/issuers/apss`, type: "Profile", name: "Asia Professional Speakers Singapore", url: siteUrl },
    validFrom: award.awarded_at,
    name: badge.name,
    credentialSubject: {
      type: "AchievementSubject",
      identifier: { type: "IdentityObject", hashed: true, identityHash: `sha256$${identityHash}`, identityType: "email", salt },
      achievement: { id: `${siteUrl}/achievements/${badge.id}`, type: "Achievement", achievementType: "Certificate", name: badge.name, description: badge.description, criteria: { narrative: badge.criteria_text }, image: { id: `${siteUrl}${badge.image_url}`, type: "Image" } },
    },
    credentialSchema: [{ id: "https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json", type: "1EdTechJsonSchemaValidator2019" }],
    credentialStatus: { id: `${siteUrl}/badges/verify/${award.verification_id}`, type: "RevocationList" },
  };
  const publicJwk = JSON.parse(process.env.OPEN_BADGES_PUBLIC_JWK ?? "{}");
  const privateJwk = JSON.parse(process.env.OPEN_BADGES_PRIVATE_JWK ?? "{}");
  const header = { alg: "EdDSA", typ: "JWT", kid: `${siteUrl}/.well-known/open-badges-key.json`, jwk: publicJwk };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(credential))}`;
  const signature = sign(null, Buffer.from(signingInput), createPrivateKey({ key: privateJwk, format: "jwk" }));
  const compactJwt = `${signingInput}.${signature.toString("base64url")}`;
  const assertion = { credential, compactJwt, signedAt: new Date().toISOString(), algorithm: "EdDSA" };
  const { error: updateError } = await admin.from("course_badge_awards").update({ assertion_json: assertion }).eq("id", award.id);
  if (updateError) throw updateError;
  return assertion;
}
