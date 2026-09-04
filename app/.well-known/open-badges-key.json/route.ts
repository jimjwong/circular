import { NextResponse } from "next/server";

export function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const key = JSON.parse(process.env.OPEN_BADGES_PUBLIC_JWK ?? "{}");
  return NextResponse.json({ ...key, kid: `${siteUrl}/.well-known/open-badges-key.json`, use: "sig", alg: "EdDSA" }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
