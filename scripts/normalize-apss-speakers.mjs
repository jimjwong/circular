// One-off normalizer for the raw asiaspeakers.org scrape. Not part of the app's
// runtime — run manually, then commit the resulting scripts/data/apss-speakers.json.
import { readFileSync, writeFileSync } from "node:fs";

const raw = JSON.parse(readFileSync("C:/Users/Jim/AppData/Local/Temp/apss-speakers-raw.json", "utf8"));

function slugFromUrl(url) {
  const m = url.match(/\/author\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

function sanitizeSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

// Order matters: "CSPGlobal" must be checked before the bare "CSP" token, or "CSP"
// would match first and leave a dangling "Global" behind.
const CREDENTIAL_PATTERNS = [
  { label: "Global Speaking Fellow", re: /,?\s*Global Speaking Fellow\b/gi },
  // "CSPGlobal, Speaking Fellow" (Philip Merry's own listing) is the same designation
  // split across two fragments by the site's own formatting; both map to one label.
  { label: "Global Speaking Fellow", re: /,?\s*CSPGlobal,?\s*Speaking Fellow\b/gi },
  { label: "CSP Global", re: /,?\s*CSPGlobal\b/gi },
  { label: "APSS Hall of Fame", re: /,?\s*APSS Hall of Fame\b/gi },
  { label: "CSP", re: /,?\s*\bCSP\b/gi },
];

function extractCredentials(rawName) {
  let name = rawName;
  const found = [];
  for (const { label, re } of CREDENTIAL_PATTERNS) {
    if (re.test(name)) {
      found.push(label);
      name = name.replace(re, "");
    }
  }
  name = name.replace(/,\s*$/, "").replace(/\s{2,}/g, " ").trim();
  return { bareName: name, credentials: found.join(", ") };
}

function memberTypesOf(credentials) {
  const types = [];
  if (/global speaking fellow/i.test(credentials)) types.push("Global Speaking Fellow");
  if (/\bCSP\b/.test(credentials)) types.push("Certified Speaking Professional (CSP)");
  return types;
}

// The source page's own <h1> repeats text for these two speakers (confirmed against
// the raw scrape, not a scraping artifact) — corrected by hand rather than with a
// generic trailing-duplicate heuristic that could misfire on other names.
const NAME_OVERRIDES = {
  "jerome-joseph": "Dr. Jerome Joseph",
  "brenda-bence-mba-csp-cspglobal": "Brenda Bence, MBA",
};

const seenSlug = new Map();
const cleaned = raw.map((r) => {
  let slug = sanitizeSlug(slugFromUrl(r.url));
  if (seenSlug.has(slug)) {
    let n = 2;
    while (seenSlug.has(`${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }
  seenSlug.set(slug, true);

  const { bareName, credentials } = extractCredentials(r.name);
  const name = NAME_OVERRIDES[slug] ?? bareName;
  const categories = (r.categories || "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    slug, sourceUrl: r.url, name, credentials, memberTypes: memberTypesOf(credentials),
    categories, website: r.website || "", photo: r.photo || "", bio: (r.bio || "").trim(),
  };
}).filter((r) => r.slug && r.name);

console.log("total:", cleaned.length);
console.log("unique slugs:", new Set(cleaned.map((r) => r.slug)).size);
console.log("with credentials:", cleaned.filter((r) => r.credentials).length);
for (const prefix of ["Cynthia Zhai", "Andrea Edward", "Ron Kaufman", "Dr. Philip Merry", "Prof James Leong"]) {
  const m = cleaned.find((r) => r.name.startsWith(prefix));
  if (m) console.log(JSON.stringify({ name: m.name, credentials: m.credentials, memberTypes: m.memberTypes }));
}

writeFileSync("scripts/data/apss-speakers.json", JSON.stringify(cleaned, null, 2));
