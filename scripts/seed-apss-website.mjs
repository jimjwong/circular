import { createClient } from "@supabase/supabase-js";
import { buildDocument } from "../lib/website/templates.ts";

// Builds the public APSS marketing site inside the website builder, using the real
// asiaspeakers.org brand palette, copy, and imagery (the org this demo tenant is
// modelled on). Re-running is safe: every write is an upsert keyed on a stable path,
// slug, or name, so the script only ever refreshes its own content.
//
// Content sources (captured 2026-09-15): homepage hero copy, About Us mission/
// objectives/focus text, footer contact details, and speaker directory entries are
// taken verbatim or near-verbatim from https://www.asiaspeakers.org/. Photos and the
// logo are hotlinked from the same site rather than downloaded, since this is a demo
// replica for the org's own tenant, not a redistribution.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Supabase local environment variables are required.");
const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: tenant, error: tenantError } = await supabase.from("tenants").select("id").eq("slug", "apss").single();
if (tenantError) throw tenantError;
const { data: owner, error: ownerError } = await supabase
  .from("tenant_memberships").select("user_id").eq("tenant_id", tenant.id).eq("role", "owner").eq("status", "active").limit(1).single();
if (ownerError) throw ownerError;
const userId = owner.user_id;

// --- Brand -------------------------------------------------------------------------
// Exact hex values read from https://www.asiaspeakers.org/ computed styles: the nav/
// button orange, the teal secondary accent, the pale page background, and the yellow
// callout used for the convention announcement banner.
const ORANGE = "#ef5222";
const ORANGE_DARK = "#d94719";
const TEAL = "#31687d";
const INK = "#202020";
const MUTED = "#707070";
const BORDER = "#d8d8d8";
const PAGE_BG = "#f0f0f0";
const YELLOW = "#ffe63b";

const LOGO_URL = "https://www.asiaspeakers.org/wp-content/uploads/2020/06/logo_2-1.png";
const HERO_PHOTO = "https://www.asiaspeakers.org/wp-content/uploads/elementor/thumbs/72957580_10157796971926942_5628704840709308416_o-p6bkgr3ng4d0aoi98x7d2vgb3rob0wbwajfqo9cu6i.jpg";

// --- Shared building blocks ----------------------------------------------------------

const NAV_LINKS = [
  ["About", "/about"], ["Speakers", "/speakers"], ["Join APSS", "/join"], ["Contact", "/contact"],
];

/** The same orange top bar and logo on every page, mirroring the real site's persistent header. */
function navBar() {
  return {
    component: "Section",
    style: { "background-color": ORANGE, padding: "16px 24px" },
    children: [{
      component: "Container",
      style: { "max-width": "1120px", margin: "0 auto", display: "flex", "align-items": "center", "justify-content": "space-between", gap: "20px" },
      children: [
        { component: "Image", props: { src: LOGO_URL, alt: "Asia Professional Speakers Singapore" }, style: { height: "44px", width: "auto" } },
        {
          component: "Container",
          style: { display: "flex", gap: "22px" },
          children: NAV_LINKS.map(([label, href]) => ({
            component: "Link", text: label, props: { href, target: "_self" },
            style: { color: "#ffffff", "font-weight": "600", "font-size": "13px", "text-decoration": "none" },
          })),
        },
      ],
    }],
  };
}

/** The real footer's mailing address, phone, email, and copyright line. */
function footer() {
  return {
    component: "Section",
    style: { "background-color": INK, padding: "48px 24px 28px", color: "#ffffff" },
    children: [{
      component: "Container",
      style: { "max-width": "1120px", margin: "0 auto" },
      children: [
        {
          component: "Container",
          style: { display: "grid", gap: "28px", "grid-template-columns": "1fr" },
          desktopStyle: { "grid-template-columns": "repeat(3, minmax(0, 1fr))" },
          children: [
            {
              component: "Container", children: [
                { component: "Heading", text: "Asia Professional Speakers Singapore", props: { level: "h3" }, style: { "font-size": "15px", "font-weight": "700", margin: "0 0 10px", color: "#ffffff" } },
                { component: "Text", text: "60 Paya Lebar Road, #06-28 Paya Lebar Square, Singapore 409051", style: { "font-size": "13px", "line-height": "1.7", color: "#c9c9c9", margin: "0" } },
              ],
            },
            {
              component: "Container", children: [
                { component: "Heading", text: "Get in touch", props: { level: "h3" }, style: { "font-size": "15px", "font-weight": "700", margin: "0 0 10px", color: "#ffffff" } },
                { component: "Text", text: "+65 9199 9075", style: { "font-size": "13px", "line-height": "1.8", color: "#c9c9c9", margin: "0" } },
                { component: "Text", text: "admin@asiaspeakers.org", style: { "font-size": "13px", "line-height": "1.8", color: "#c9c9c9", margin: "0" } },
              ],
            },
            {
              component: "Container", children: [
                { component: "Heading", text: "Quick links", props: { level: "h3" }, style: { "font-size": "15px", "font-weight": "700", margin: "0 0 10px", color: "#ffffff" } },
                { component: "Link", text: "Speakers directory", props: { href: "/speakers", target: "_self" }, style: { display: "block", "font-size": "13px", color: "#c9c9c9", "margin-bottom": "6px", "text-decoration": "none" } },
                { component: "Link", text: "Join APSS", props: { href: "/join", target: "_self" }, style: { display: "block", "font-size": "13px", color: "#c9c9c9", "text-decoration": "none" } },
              ],
            },
          ],
        },
        { component: "Divider", style: { "border-top": "1px solid #3a3a3a", margin: "32px 0 18px" } },
        { component: "Text", text: "© 2016 Asia Professional Speakers - Singapore", style: { "font-size": "12px", color: "#8f8f8f", margin: "0" } },
      ],
    }],
  };
}

function button(labelText, href, variant = "solid") {
  const solid = { display: "inline-block", padding: "13px 26px", "border-radius": "6px", "background-color": YELLOW, color: ORANGE_DARK, "font-weight": "700", "font-size": "13px", "text-decoration": "none", border: `2px solid ${ORANGE_DARK}` };
  const outline = { display: "inline-block", padding: "12px 25px", "border-radius": "6px", "background-color": "transparent", color: "#ffffff", "font-weight": "700", "font-size": "13px", "text-decoration": "none", border: "2px solid #ffffff" };
  return { component: "Button", text: labelText, props: { href, target: "_self" }, style: variant === "solid" ? solid : outline };
}

const H2 = { "font-size": "30px", "font-weight": "800", color: INK, margin: "0 0 14px", "letter-spacing": "-0.01em" };
const BODY = { "font-size": "15px", "line-height": "1.75", color: MUTED, margin: "0 0 16px" };
const SECTION = { padding: "64px 24px", "background-color": "#ffffff" };
const WRAP = { "max-width": "1080px", margin: "0 auto" };
const CARD = { padding: "26px", "border-radius": "10px", border: `1px solid ${BORDER}`, "background-color": "#ffffff" };

// --- Home ----------------------------------------------------------------------------

function homeTree(speakersCollectionId) {
  return [
    navBar(),
    {
      component: "Section",
      style: { "background-image": `url(${HERO_PHOTO})`, "background-size": "cover", "background-position": "center", padding: "0", position: "relative" },
      children: [{
        component: "Container",
        style: { "background-color": "rgba(20,20,20,.58)", padding: "90px 24px", "text-align": "center" },
        children: [{
          component: "Container", style: { "max-width": "760px", margin: "0 auto" },
          children: [
            { component: "Eyebrow", text: "Asia Professional Speakers Singapore", style: { color: YELLOW, "font-size": "12px", "font-weight": "700", "letter-spacing": "0.16em", "text-transform": "uppercase" } },
            { component: "Heading", text: "Singapore's professional keynote speakers, corporate trainers and facilitators", props: { level: "h1" }, style: { color: "#ffffff", "font-size": "32px", "font-weight": "800", margin: "18px 0 16px", "line-height": "1.25" }, desktopStyle: { "font-size": "44px" } },
            { component: "Text", text: "APSS is a community dedicated to elevating the professional speaking community in Singapore and across Asia. Our members are subject matter experts who already speak and/or train professionally, and others who aspire to become professional speakers and trainers.", style: { color: "#e7e7e7", "font-size": "15px", "line-height": "1.7", margin: "0 0 28px" } },
            { component: "Container", style: { display: "flex", gap: "14px", "justify-content": "center", "flex-wrap": "wrap" }, children: [button("Join APSS", "/join", "solid"), button("Meet our speakers", "/speakers", "outline")] },
          ],
        }],
      }],
    },
    {
      component: "Section", style: { ...SECTION, "background-color": PAGE_BG },
      children: [{
        component: "Container", style: WRAP,
        children: [
          { component: "Eyebrow", text: "Our programs", style: { color: ORANGE, "font-size": "12px", "font-weight": "700", "letter-spacing": "0.14em", "text-transform": "uppercase" } },
          { component: "Heading", text: "Upcoming events", props: { level: "h2" }, style: { ...H2, margin: "10px 0 6px" } },
          { component: "Text", text: "Workshops, signature events, and the APSS Convention.", style: { ...BODY, margin: "0 0 28px" } },
          { component: "EventList", props: { heading: "", limit: 4 }, style: { display: "block" } },
        ],
      }],
    },
    {
      component: "Section", style: SECTION,
      children: [{
        component: "Container", style: WRAP,
        children: [{
          component: "Container",
          style: { display: "grid", gap: "40px", "grid-template-columns": "1fr", "align-items": "center" },
          desktopStyle: { "grid-template-columns": "1.1fr .9fr" },
          children: [
            { component: "Container", children: [
              { component: "Eyebrow", text: "Why APSS", style: { color: ORANGE, "font-size": "12px", "font-weight": "700", "letter-spacing": "0.14em", "text-transform": "uppercase" } },
              { component: "Heading", text: "A welcoming, supportive community", props: { level: "h2" }, style: { ...H2, margin: "10px 0 14px" } },
              { component: "Text", text: "Our goal is to grow, facilitate, encourage, develop and contribute to the community of speaking professionals in Singapore. We are a welcoming and very supportive community, always committed to the success of our members.", style: BODY },
              button("Learn about APSS", "/about", "solid"),
            ] },
            { component: "Container", style: { display: "grid", "grid-template-columns": "1fr 1fr", gap: "14px" }, children: [
              { component: "Container", style: CARD, children: [
                { component: "Heading", text: "Expertise", props: { level: "h3" }, style: { "font-size": "16px", "font-weight": "700", margin: "0 0 6px", color: TEAL } },
                { component: "Text", text: "Knowledge, skills, and experience.", style: { ...BODY, "font-size": "13px", margin: "0" } },
              ] },
              { component: "Container", style: CARD, children: [
                { component: "Heading", text: "Eloquence", props: { level: "h3" }, style: { "font-size": "16px", "font-weight": "700", margin: "0 0 6px", color: TEAL } },
                { component: "Text", text: "The art of powerful, persuasive presentation.", style: { ...BODY, "font-size": "13px", margin: "0" } },
              ] },
              { component: "Container", style: { ...CARD, "grid-column": "1 / span 2" }, children: [
                { component: "Heading", text: "Enterprise", props: { level: "h3" }, style: { "font-size": "16px", "font-weight": "700", margin: "0 0 6px", color: TEAL } },
                { component: "Text", text: "The skills needed to run a successful speaking business.", style: { ...BODY, "font-size": "13px", margin: "0" } },
              ] },
            ] },
          ],
        }],
      }],
    },
    {
      component: "Section", style: { ...SECTION, "background-color": PAGE_BG },
      children: [{
        component: "Container", style: WRAP,
        children: [
          { component: "Eyebrow", text: "Our members", style: { color: ORANGE, "font-size": "12px", "font-weight": "700", "letter-spacing": "0.14em", "text-transform": "uppercase" } },
          { component: "Heading", text: "Meet a few of our speakers", props: { level: "h2" }, style: { ...H2, margin: "10px 0 24px" } },
          {
            component: "CollectionList", props: { collectionId: speakersCollectionId, limit: 4 },
            style: { display: "grid", gap: "18px", "grid-template-columns": "1fr" },
            desktopStyle: { "grid-template-columns": "repeat(4, minmax(0, 1fr))" },
            children: [{
              component: "Container", style: { ...CARD, padding: "0", overflow: "hidden", "text-align": "center" },
              children: [
                { component: "CollectionField", props: { field: "photo", asImage: true }, style: { width: "100%", height: "160px", "object-fit": "cover", display: "block" } },
                { component: "Container", style: { padding: "16px" }, children: [
                  { component: "CollectionField", props: { field: "title" }, style: { display: "block", "font-weight": "700", "font-size": "14px", color: INK } },
                  { component: "CollectionField", props: { field: "credentials" }, style: { display: "block", "font-size": "12px", color: ORANGE, "font-weight": "600", margin: "4px 0" } },
                  { component: "CollectionField", props: { field: "categories" }, style: { display: "block", "font-size": "11px", color: MUTED } },
                ] },
              ],
            }],
          },
          { component: "Container", style: { "text-align": "center", "margin-top": "28px" }, children: [button("View all speakers", "/speakers", "solid")] },
        ],
      }],
    },
    {
      component: "Section", style: { ...SECTION, "background-color": ORANGE, "text-align": "center" },
      children: [{ component: "Container", style: { ...WRAP, "max-width": "640px" }, children: [
        { component: "Heading", text: "Ready to grow as a speaking professional?", props: { level: "h2" }, style: { color: "#ffffff", "font-size": "26px", "font-weight": "800", margin: "0 0 22px" } },
        button("Join APSS today", "/signup", "solid"),
      ] }],
    },
    footer(),
  ];
}

// --- About ---------------------------------------------------------------------------

function aboutTree() {
  return [
    navBar(),
    {
      component: "Section", style: { ...SECTION, "background-color": TEAL, "text-align": "center" },
      children: [{ component: "Container", style: { ...WRAP, "max-width": "760px" }, children: [
        { component: "Quote", text: "You don't have to be great to get started, but you have to get started to be great.", props: { cite: "— Les Brown" }, style: { color: "#ffffff", "font-size": "22px", "font-weight": "600", "font-style": "italic", "line-height": "1.5" } },
      ] }],
    },
    {
      component: "Section", style: SECTION,
      children: [{ component: "Container", style: { ...WRAP, "max-width": "760px" }, children: [
        { component: "Eyebrow", text: "About us", style: { color: ORANGE, "font-size": "12px", "font-weight": "700", "letter-spacing": "0.14em", "text-transform": "uppercase" } },
        { component: "Heading", text: "Established 30 September 2003", props: { level: "h2" }, style: { ...H2, margin: "10px 0 18px" } },
        { component: "Text", text: "Asia Professional Speakers Singapore (APSS) is an association whose membership is made up of subject experts who are already speaking and/or training professionally, and others who aspire to become professional speakers or trainers.", style: BODY },
        { component: "Text", text: "Our members are from a wide spectrum of industries and disciplines, reaching audiences as mentors, educators, trainers, consultants, authors and more.", style: BODY },
        { component: "Image", props: { src: HERO_PHOTO, alt: "APSS members at a community event" }, style: { width: "100%", "border-radius": "14px", margin: "28px 0" } },
        { component: "Heading", text: "Objectives", props: { level: "h3" }, style: { "font-size": "20px", "font-weight": "700", color: INK, margin: "8px 0 12px" } },
        { component: "Text", text: "Grow, facilitate, encourage, develop and contribute to the community of speaking professionals in Singapore. Improve the standard of professional speaking by developing speaking techniques and sharing knowledge, experience, and expertise among members. Provide opportunities for members to share their expertise with the community through signature events and other initiatives. Help develop the professional speaking industry and the community of speakers across Asia.", style: BODY },
      ] }],
    },
    {
      component: "Section", style: { ...SECTION, "background-color": PAGE_BG },
      children: [{ component: "Container", style: WRAP, children: [
        { component: "Heading", text: "Our focus", props: { level: "h2" }, style: { ...H2, "text-align": "center", margin: "0 0 28px" } },
        {
          component: "Container",
          style: { display: "grid", gap: "20px", "grid-template-columns": "1fr" },
          desktopStyle: { "grid-template-columns": "repeat(3, minmax(0, 1fr))" },
          children: [
            { component: "Container", style: CARD, children: [
              { component: "Heading", text: "Expertise", props: { level: "h3" }, style: { "font-size": "18px", "font-weight": "700", margin: "0 0 8px", color: TEAL } },
              { component: "Text", text: "Knowledge, skills and experience, with particular emphasis on applying that knowledge in front of an audience.", style: { ...BODY, margin: "0" } },
            ] },
            { component: "Container", style: CARD, children: [
              { component: "Heading", text: "Eloquence", props: { level: "h3" }, style: { "font-size": "18px", "font-weight": "700", margin: "0 0 8px", color: TEAL } },
              { component: "Text", text: "The art of speaking, and the use of powerful and persuasive presentations, performance, and setting.", style: { ...BODY, margin: "0" } },
            ] },
            { component: "Container", style: CARD, children: [
              { component: "Heading", text: "Enterprise", props: { level: "h3" }, style: { "font-size": "18px", "font-weight": "700", margin: "0 0 8px", color: TEAL } },
              { component: "Text", text: "The business skills needed to build and run a successful, sustainable speaking business.", style: { ...BODY, margin: "0" } },
            ] },
          ],
        },
      ] }],
    },
    footer(),
  ];
}

// --- Speakers --------------------------------------------------------------------------

function speakersTree(speakersCollectionId) {
  return [
    navBar(),
    {
      component: "Section", style: { ...SECTION, "background-color": ORANGE, "text-align": "center", padding: "56px 24px" },
      children: [{ component: "Container", children: [
        { component: "Eyebrow", text: "Find a speaker", style: { color: YELLOW, "font-size": "12px", "font-weight": "700", "letter-spacing": "0.16em", "text-transform": "uppercase" } },
        { component: "Heading", text: "Our speakers", props: { level: "h1" }, style: { color: "#ffffff", "font-size": "34px", "font-weight": "800", margin: "12px 0 10px" } },
        { component: "Text", text: "Professional Members, Certified Speaking Professionals, and Global Speaking Fellows across every industry and topic.", style: { color: "#fde7de", "font-size": "14px", "max-width": "560px", margin: "0 auto" } },
      ] }],
    },
    {
      component: "Section", style: SECTION,
      children: [{ component: "Container", style: WRAP, children: [
        {
          component: "CollectionList", props: { collectionId: speakersCollectionId, limit: 24 },
          style: { display: "grid", gap: "20px", "grid-template-columns": "1fr" },
          desktopStyle: { "grid-template-columns": "repeat(3, minmax(0, 1fr))" },
          children: [{
            component: "Container", style: { ...CARD, padding: "0", overflow: "hidden" },
            children: [
              { component: "CollectionField", props: { field: "photo", asImage: true }, style: { width: "100%", height: "220px", "object-fit": "cover", display: "block", "background-color": PAGE_BG } },
              { component: "Container", style: { padding: "18px" }, children: [
                { component: "CollectionField", props: { field: "title" }, style: { display: "block", "font-weight": "700", "font-size": "16px", color: INK } },
                { component: "CollectionField", props: { field: "credentials" }, style: { display: "block", "font-size": "12px", color: ORANGE, "font-weight": "600", margin: "4px 0 8px" } },
                { component: "CollectionField", props: { field: "categories" }, style: { display: "block", "font-size": "12px", color: MUTED, "line-height": "1.5" } },
              ] },
            ],
          }],
        },
      ] }],
    },
    footer(),
  ];
}

// --- Join ------------------------------------------------------------------------------

function joinTree() {
  return [
    navBar(),
    {
      component: "Section", style: { ...SECTION, "background-color": TEAL, "text-align": "center" },
      children: [{ component: "Container", style: { ...WRAP, "max-width": "680px" }, children: [
        { component: "Eyebrow", text: "Join APSS", style: { color: YELLOW, "font-size": "12px", "font-weight": "700", "letter-spacing": "0.16em", "text-transform": "uppercase" } },
        { component: "Heading", text: "Grow your speaking business, with a community behind you", props: { level: "h1" }, style: { color: "#ffffff", "font-size": "30px", "font-weight": "800", margin: "12px 0 16px", "line-height": "1.3" } },
        { component: "Text", text: "Anyone can join APSS as an Associate Member. Members with public listings are Professional Members, Certified Speaking Professionals, and CSP Globals.", style: { color: "#e2eef2", "font-size": "14px" } },
      ] }],
    },
    {
      component: "Section", style: SECTION,
      children: [{ component: "Container", style: WRAP, children: [
        {
          component: "Container",
          style: { display: "grid", gap: "18px", "grid-template-columns": "1fr" },
          desktopStyle: { "grid-template-columns": "repeat(3, minmax(0, 1fr))" },
          children: [
            { component: "Container", style: CARD, children: [
              { component: "Heading", text: "Associate Member", props: { level: "h3" }, style: { "font-size": "17px", "font-weight": "700", margin: "0 0 8px", color: INK } },
              { component: "Text", text: "Open to anyone building toward a professional speaking or training practice. Blog on the APSS site and learn from the community.", style: { ...BODY, margin: "0" } },
            ] },
            { component: "Container", style: CARD, children: [
              { component: "Heading", text: "Professional Member", props: { level: "h3" }, style: { "font-size": "17px", "font-weight": "700", margin: "0 0 8px", color: INK } },
              { component: "Text", text: "For subject matter experts with a demonstrated history of professionally paid speaking engagements, listed in the speaker directory.", style: { ...BODY, margin: "0" } },
            ] },
            { component: "Container", style: CARD, children: [
              { component: "Heading", text: "Certified Speaking Professional", props: { level: "h3" }, style: { "font-size": "17px", "font-weight": "700", margin: "0 0 8px", color: INK } },
              { component: "Text", text: "The industry's international measure of speaking experience and skill, awarded through the Global Speakers Federation.", style: { ...BODY, margin: "0" } },
            ] },
          ],
        },
        { component: "Container", style: { "text-align": "center", "margin-top": "32px" }, children: [
          { component: "Heading", text: "Ready to get started?", props: { level: "h2" }, style: { ...H2, "text-align": "center", margin: "0 0 18px" } },
          button("Create your account", "/signup", "solid"),
        ] },
      ] }],
    },
    footer(),
  ];
}

// --- Contact ----------------------------------------------------------------------------

function contactTree() {
  return [
    navBar(),
    {
      component: "Section", style: SECTION,
      children: [{ component: "Container", style: { ...WRAP, "max-width": "980px" }, children: [
        { component: "Heading", text: "Contact us", props: { level: "h1" }, style: { ...H2, "font-size": "32px", "text-align": "center", margin: "0 0 32px" } },
        {
          component: "Container",
          style: { display: "grid", gap: "36px", "grid-template-columns": "1fr" },
          desktopStyle: { "grid-template-columns": "1.1fr .9fr" },
          children: [
            {
              component: "Form", props: { submitLabel: "Send message" },
              style: { display: "flex", "flex-direction": "column", gap: "14px", padding: "26px", "background-color": "#ffffff", "border-radius": "12px", border: `1px solid ${BORDER}` },
              children: [
                { component: "Input", props: { label: "Name", name: "name", inputType: "text", required: true } },
                { component: "Input", props: { label: "Email", name: "email", inputType: "email", required: true } },
                { component: "Input", props: { label: "Subject", name: "subject", inputType: "text", required: false } },
                { component: "Input", props: { label: "Message", name: "message", inputType: "textarea", required: true } },
              ],
            },
            { component: "Container", children: [
              { component: "Heading", text: "Mailing address", props: { level: "h3" }, style: { "font-size": "15px", "font-weight": "700", color: INK, margin: "0 0 6px" } },
              { component: "Text", text: "60 Paya Lebar Road, #06-28 Paya Lebar Square, Singapore 409051", style: { ...BODY, margin: "0 0 20px" } },
              { component: "Heading", text: "Phone", props: { level: "h3" }, style: { "font-size": "15px", "font-weight": "700", color: INK, margin: "0 0 6px" } },
              { component: "Text", text: "+65 9199 9075", style: { ...BODY, margin: "0 0 20px" } },
              { component: "Heading", text: "Email", props: { level: "h3" }, style: { "font-size": "15px", "font-weight": "700", color: INK, margin: "0 0 6px" } },
              { component: "Link", text: "admin@asiaspeakers.org", props: { href: "mailto:admin@asiaspeakers.org", target: "_self" }, style: { color: ORANGE, "font-weight": "600", "text-decoration": "none" } },
            ] },
          ],
        },
      ] }],
    },
    footer(),
  ];
}

// --- Speakers collection ---------------------------------------------------------------
// Names, credentials, category tags, and photos taken from the APSS speaker directory.
// Anna Ong is omitted: the directory listing had no photo or category data for her, and
// nothing should be fabricated in her place. Dr. Damini Chawla is included without a
// photo for the same reason — none was captured for her.

const SPEAKERS = [
  { name: "Dr. Frank Hagenow", slug: "frank-hagenow", credentials: "CSP", categories: "Management, Leadership, Conflict Resolution", photo: "https://www.asiaspeakers.org/wp-content/uploads/2020/08/APSSfh5898.jpg" },
  { name: "Karen Leong", slug: "karen-leong", credentials: "CSP", categories: "Motivation, Leadership, Change Management", photo: "https://www.asiaspeakers.org/wp-content/uploads/2022/03/Karen-Profile-Photo-Head-Shot2817.jpg" },
  { name: "Dr. Jerome Joseph", slug: "jerome-joseph", credentials: "CSP, Global Speaking Fellow, APSS Hall of Fame", categories: "Culture, Strategy, Branding", photo: "https://www.asiaspeakers.org/wp-content/uploads/2022/07/Global-Guru2022_RankNo2_v2_alt3847.jpg" },
  { name: "Ron Kaufman", slug: "ron-kaufman", credentials: "CSP, Global Speaking Fellow, APSS Hall of Fame", categories: "Motivation, Management, Leadership, Customer Service, Organisation Development, Productivity", photo: "https://www.asiaspeakers.org/wp-content/uploads/2023/05/0-Ron-Kaufman-11096.jpg" },
  { name: "Prof James Leong", slug: "james-leong", credentials: "CSP", categories: "Finance, Humour", photo: "https://www.asiaspeakers.org/wp-content/uploads/2020/08/HAPY0419E-final-v25552.png" },
  { name: "Wesley Chan", slug: "wesley-chan", credentials: "CSP", categories: "Peak Performance, Personal Development, Sales/Negotiation", photo: "https://www.asiaspeakers.org/wp-content/uploads/2022/09/VIC_1497-min-45578.jpg" },
  { name: "Dane Tang", slug: "dane-tang", credentials: "", categories: "Leadership", photo: "https://www.asiaspeakers.org/wp-content/uploads/2022/03/Dane-Tang-corporate-24559.jpg" },
  { name: "Dr. Damini Chawla", slug: "damini-chawla", credentials: "", categories: "Leadership, Conflict Resolution, Communication / Voice", photo: "" },
];

async function upsertCollection() {
  const payload = {
    site_id: site.id, tenant_id: tenant.id, name: "Speakers", slug: "speakers",
    description: "APSS professional speakers, trainers, and facilitators.",
    fields: [
      { key: "photo", label: "Photo", type: "image", required: false },
      { key: "credentials", label: "Credentials", type: "text", required: false },
      { key: "categories", label: "Categories", type: "text", required: false },
    ],
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase.from("website_collections").select("id").eq("site_id", site.id).eq("slug", "speakers").maybeSingle();
  if (existing) { await supabase.from("website_collections").update(payload).eq("id", existing.id); return existing.id; }
  const { data, error } = await supabase.from("website_collections").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

async function upsertSpeaker(collectionId, speaker) {
  const payload = {
    collection_id: collectionId, tenant_id: tenant.id, slug: speaker.slug, title: speaker.name, status: "published",
    data: { photo: speaker.photo, credentials: speaker.credentials, categories: speaker.categories },
    published_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase.from("website_collection_entries").select("id").eq("collection_id", collectionId).eq("slug", speaker.slug).maybeSingle();
  if (existing) return supabase.from("website_collection_entries").update(payload).eq("id", existing.id);
  return supabase.from("website_collection_entries").insert({ ...payload, created_by: userId });
}

// --- Site + pages -----------------------------------------------------------------------

const SITE_SLUG = "apss";

async function upsertSite() {
  const { data: existing } = await supabase.from("website_sites").select("id").eq("tenant_id", tenant.id).eq("slug", SITE_SLUG).maybeSingle();
  const payload = {
    tenant_id: tenant.id, name: "APSS", slug: SITE_SLUG,
    description: "Asia Professional Speakers Singapore — the public marketing site.",
    status: "published", favicon_url: LOGO_URL, social_image_url: HERO_PHOTO,
    brand: { primary: ORANGE, primaryHover: ORANGE_DARK, accent: TEAL, background: PAGE_BG, headingFont: "manrope", bodyFont: "inter" },
    created_by: userId, updated_at: new Date().toISOString(),
  };
  if (existing) { await supabase.from("website_sites").update(payload).eq("id", existing.id); return existing.id; }
  const { data, error } = await supabase.from("website_sites").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

async function upsertPage({ name, path, kind, document, title, description }) {
  const base = {
    site_id: site.id, tenant_id: tenant.id, name, path, kind, title, description,
    document, status: "published", created_by: userId, updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase.from("website_pages").select("id").eq("site_id", site.id).eq("path", path).maybeSingle();
  let pageId = existing?.id;
  if (pageId) await supabase.from("website_pages").update(base).eq("id", pageId);
  else {
    const { data, error } = await supabase.from("website_pages").insert(base).select("id").single();
    if (error) throw error;
    pageId = data.id;
  }
  const { data: version, error: versionError } = await supabase.from("website_page_versions").insert({
    page_id: pageId, tenant_id: tenant.id, document, label: "Seeded from asiaspeakers.org", created_by: userId,
  }).select("id").single();
  if (versionError) throw versionError;
  await supabase.from("website_pages").update({ published_version_id: version.id }).eq("id", pageId);
  return pageId;
}

async function upsertDirectoryMount() {
  const { data: existing } = await supabase.from("website_domains").select("id").eq("site_id", site.id).eq("kind", "directory").maybeSingle();
  const payload = {
    site_id: site.id, tenant_id: tenant.id, kind: "directory", base_path: SITE_SLUG,
    is_primary: true, status: "verified", verified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  if (existing) return supabase.from("website_domains").update(payload).eq("id", existing.id);
  const { error } = await supabase.from("website_domains").insert(payload);
  if (error && error.code !== "23505") throw error;
}

const siteId = await upsertSite();
const site = { id: siteId };
const collectionId = await upsertCollection();
for (const speaker of SPEAKERS) await upsertSpeaker(collectionId, speaker);

const homeId = await upsertPage({
  name: "Home", path: "/", kind: "landing", title: "APSS",
  description: "Singapore's professional keynote speakers, corporate trainers and facilitators.",
  document: buildDocument(homeTree(collectionId)),
});
await upsertPage({
  name: "About", path: "/about", kind: "page", title: "About APSS",
  description: "Established 30 September 2003 — our mission, objectives, and focus.",
  document: buildDocument(aboutTree()),
});
await upsertPage({
  name: "Speakers", path: "/speakers", kind: "page", title: "Our speakers",
  description: "Professional Members, Certified Speaking Professionals, and Global Speaking Fellows.",
  document: buildDocument(speakersTree(collectionId)),
});
await upsertPage({
  name: "Join", path: "/join", kind: "funnel", title: "Join APSS",
  description: "Membership tiers and how to join Asia Professional Speakers Singapore.",
  document: buildDocument(joinTree()),
});
await upsertPage({
  name: "Contact", path: "/contact", kind: "page", title: "Contact APSS",
  description: "Mailing address, phone, and email for Asia Professional Speakers Singapore.",
  document: buildDocument(contactTree()),
});
await supabase.from("website_sites").update({ home_page_id: homeId }).eq("id", siteId);
await upsertDirectoryMount();

const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3001";
console.log(JSON.stringify({
  site: "APSS", speakers: SPEAKERS.length,
  pages: ["/", "/about", "/speakers", "/join", "/contact"],
  publicUrls: [`${origin}/${SITE_SLUG}`, `${origin}/${SITE_SLUG}/about`, `${origin}/${SITE_SLUG}/speakers`],
}, null, 2));
