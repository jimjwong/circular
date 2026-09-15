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
  ["About", "/about"], ["Speakers", "/speakers"], ["Blog", "/blog"], ["Join APSS", "/join"], ["Contact", "/contact"],
];

/** The same orange top bar and logo on every page, mirroring the real site's persistent header. */
function navBar() {
  return {
    component: "Section",
    style: { "background-color": ORANGE, padding: "16px 24px" },
    children: [{
      component: "Container",
      // Mobile-first: wrap onto a second row rather than overflow the viewport (the
      // builder has no hamburger-menu primitive, so wrapping is the responsive fallback).
      style: { "max-width": "1120px", margin: "0 auto", display: "flex", "flex-wrap": "wrap", "align-items": "center", "justify-content": "center", "row-gap": "12px", "column-gap": "16px" },
      desktopStyle: { "justify-content": "space-between" },
      children: [
        { component: "Image", props: { src: LOGO_URL, alt: "Asia Professional Speakers Singapore" }, style: { height: "36px", width: "auto" }, desktopStyle: { height: "44px" } },
        {
          component: "Container",
          style: { display: "flex", "flex-wrap": "wrap", "justify-content": "center", gap: "14px" },
          desktopStyle: { gap: "22px" },
          children: NAV_LINKS.map(([label, href]) => ({
            component: "Link", text: label, props: { href, target: "_self" },
            style: { color: "#ffffff", "font-weight": "600", "font-size": "12px", "text-decoration": "none", "white-space": "nowrap" },
            desktopStyle: { "font-size": "13px" },
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

// --- Blog ------------------------------------------------------------------------------
// One shared card layout for both the listing and, styled slightly larger, the header of
// an individual post — kept as a function so the two stay visually consistent.

function blogCard(blogCollectionId, { compact }) {
  return {
    component: "Container", style: { ...CARD, padding: "0", overflow: "hidden", display: "flex", "flex-direction": "column" },
    children: [
      { component: "CollectionField", props: { field: "cover", asImage: true }, style: { width: "100%", height: compact ? "160px" : "220px", "object-fit": "cover", display: "block", "background-color": PAGE_BG } },
      { component: "Container", style: { padding: "18px", display: "flex", "flex-direction": "column", gap: "6px", flex: "1" }, children: [
        { component: "CollectionField", props: { field: "categories" }, style: { display: "block", "font-size": "10px", "font-weight": "700", color: TEAL, "text-transform": "uppercase", "letter-spacing": "0.06em" } },
        { component: "CollectionField", props: { field: "title", hrefTemplate: "/blog/:slug" }, style: { display: "block", "font-size": compact ? "15px" : "17px", "font-weight": "700", color: ORANGE, "text-decoration": "none", "line-height": "1.35", margin: "2px 0" } },
        { component: "CollectionField", props: { field: "meta" }, style: { display: "block", "font-size": "11px", color: MUTED, "margin-bottom": "4px" } },
        { component: "CollectionField", props: { field: "excerpt" }, style: { display: "block", "font-size": "13px", color: MUTED, "line-height": "1.6" } },
      ] },
    ],
  };
}

function blogTree(blogCollectionId) {
  return [
    navBar(),
    {
      component: "Section", style: { ...SECTION, "background-color": PAGE_BG, "text-align": "center", padding: "56px 24px" },
      children: [{ component: "Container", children: [
        { component: "Eyebrow", text: "The APSS blog", style: { color: ORANGE, "font-size": "12px", "font-weight": "700", "letter-spacing": "0.16em", "text-transform": "uppercase" } },
        { component: "Heading", text: "From our blog", props: { level: "h1" }, style: { ...H2, "font-size": "32px", margin: "12px 0 10px" } },
        { component: "Text", text: "Read exclusive content from our members here on the blog.", style: { ...BODY, "max-width": "480px", margin: "0 auto" } },
      ] }],
    },
    {
      component: "Section", style: SECTION,
      children: [{ component: "Container", style: WRAP, children: [
        {
          component: "CollectionList", props: { collectionId: blogCollectionId, limit: 12 },
          style: { display: "grid", gap: "22px", "grid-template-columns": "1fr" },
          desktopStyle: { "grid-template-columns": "repeat(3, minmax(0, 1fr))" },
          children: [blogCard(blogCollectionId, { compact: true })],
        },
      ] }],
    },
    footer(),
  ];
}

/** A single post, reached via the /blog/:slug collection template. */
function blogPostTree() {
  return [
    navBar(),
    {
      component: "Section", style: SECTION,
      children: [{ component: "Container", style: { ...WRAP, "max-width": "760px" }, children: [
        { component: "CollectionField", props: { field: "categories" }, style: { display: "block", "font-size": "11px", "font-weight": "700", color: TEAL, "text-transform": "uppercase", "letter-spacing": "0.08em", "margin-bottom": "10px" } },
        { component: "CollectionField", props: { field: "title" }, style: { display: "block", "font-size": "30px", "font-weight": "800", color: INK, "line-height": "1.25", margin: "0 0 10px" } },
        { component: "CollectionField", props: { field: "meta" }, style: { display: "block", "font-size": "13px", color: MUTED, "margin-bottom": "24px" } },
        { component: "CollectionField", props: { field: "cover", asImage: true }, style: { width: "100%", "border-radius": "14px", margin: "0 0 28px", "max-height": "420px", "object-fit": "cover" } },
        { component: "CollectionField", props: { field: "body" }, style: { display: "block", "font-size": "15px", "line-height": "1.8", color: "#3a3a3a", "white-space": "pre-line" } },
        { component: "Container", style: { "margin-top": "36px", "padding-top": "20px", "border-top": `1px solid ${BORDER}` }, children: [
          { component: "Link", text: "← Back to the blog", props: { href: "/blog", target: "_self" }, style: { color: ORANGE, "font-weight": "700", "font-size": "13px", "text-decoration": "none" } },
        ] },
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

async function upsertSpeakersCollection() {
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

// --- Blog collection ---------------------------------------------------------------
// Six recent posts from https://www.asiaspeakers.org/blog/, taken from each post's own
// page (title, author, date, category, cover image, and full body text).

const BLOG_POSTS = [
  {
    slug: "beyond-the-agenda-mastering-the-art-of-sensing",
    title: "BEYOND THE AGENDA: Mastering the Art of Sensing as a Speaker/Facilitator.",
    author: "Dr. Philip Merry CSP,CSPGlobal, Speaking Fellow", date: "September 5, 2026", categories: "Team Coaching",
    cover: "https://www.asiaspeakers.org/wp-content/uploads/2026/09/Screenshot-2026-08-29-at-14.02.28-1.png",
    excerpt: "How facilitators and speakers access intuition and collective intelligence to recognise what a team or audience needs next.",
    body: `This photograph captures an important moment during a recent divisional team retreat I recently facilitated.

The participants are working together at their tables. I have stepped aside, closed my eyes and become still. I am not disengaged or taking a break. A recent issue that was not on the agenda has just been raised, and I am sensing what to do.

I am listening beneath the words and activity to intuit what the team needs next.

Some might describe this as reading the room. I experience it at a deeper level—as sensing the quantum field of information that surrounds and connects the group.

Facilitation Is More Than Following a Plan

Every effective team retreat needs a clear purpose, thoughtful design and well-chosen activities. But a team is a living human system, not a machine that will automatically follow the facilitator's agenda.

A facilitator may arrive with an excellent plan, yet something unexpected emerges: an uncomfortable silence follows an apparently innocent question, one voice begins to dominate, energy suddenly disappears from the room, a conversation moves away from the agenda to what truly matters, participants become animated around an issue that had seemed unimportant, or a disagreement reveals the real challenge facing the team.

At these moments, facilitators have a choice. We can force the group back onto the predetermined agenda—or pause, sense what is happening and respond to what the team actually needs.

The most important intervention is not always the one written in the facilitator's guide.

What Does It Mean to Sense a Team?

Sensing involves paying attention to several levels of information simultaneously. We listen to what people are saying, but also notice what they are not saying. We observe body language, tone of voice, participation patterns, emotional shifts and changes in the energy of the room.

But sensing goes beyond observation. It means quietening our own internal chatter and becoming receptive to intuition: the subtle inner knowing that may indicate it is time to ask a different question, invite another voice, remain silent, challenge the group—or completely change direction.

Sometimes I will suddenly know that the planned activity is no longer appropriate. At other times, a question arises in my mind that I had not prepared for. When I trust that intuition and ask it, the conversation often moves to the heart of the matter.

This does not mean abandoning experience, evidence or professional judgement. Intuition works alongside them. Decades of facilitation create a deep reservoir of pattern recognition—but there are also moments when we access information through the collective field itself.

From Reading the Room to Sensing the Field

Teams generate more than individual opinions. As people interact, they create a collective emotional and informational field. When a team develops greater coherence—when people become more present, connected and open—new insights often emerge.`,
  },
  {
    slug: "toward-a-theory-of-team-synchronicity",
    title: "Toward a Theory of Team Synchronicity",
    author: "Dr. Philip Merry CSP,CSPGlobal, Speaking Fellow", date: "June 11, 2026", categories: "Team Coaching",
    cover: "https://www.asiaspeakers.org/wp-content/uploads/2026/06/Philip-Merry-post-1200x803.jpeg",
    excerpt: "This study provides one of the first structured analyses of how synchronicity manifests within organisational teams.",
    body: `A Qualitative Study of Behaviours, Facilitation Practices, and Quantum Leadership Qualities. Based on empirical data from the Research Session at the Singapore Facilitator's Network Conference, November 2025.

Philip Merry PhD, CEO TeamSynchronicity, www.philipmerry.com

Abstract

Although synchronicity has been widely discussed in psychology and leadership discourse, limited empirical research has examined what synchronicity looks like within organisational teams. This qualitative study analyses descriptive data from a multi-participant exploration of synchronicity in teams, identifying three major domains: (1) behavioural markers of team synchronicity; (2) facilitation practices that cultivate synchronicity; and (3) the qualities of a "quantum facilitator." Findings suggest that synchronicity manifests not merely as rare, extraordinary events, but as an emergent relational capacity involving intuition, openness, pattern recognition, and collective sensemaking. Implications for quantum leadership and psychological safety are discussed.

Introduction

Synchronicity—defined as meaningful coincidences that provide insight, guidance, or timely support—has traditionally been understood through the lens of individual experience. Emerging scholarship in quantum leadership suggests that synchronicity may also operate at the team level, influencing decision-making, creativity, alignment, and problem-solving (Merry, 2017). Yet empirical descriptions of team-based synchronicity remain sparse.

This research article synthesises qualitative data from a facilitated exploration of synchronicity among organisational practitioners. The purpose is to articulate what synchronicity looks like in teams, what facilitators do to encourage it, and what defines a "quantum facilitator." These findings contribute to an emerging field at the intersection of synchronicity studies, team psychological safety, and quantum leadership.

Methodology

The dataset used for this study consists of qualitative responses collected during a professional learning session on synchronicity in teams at the Singapore Facilitators Network Conference in November 2025. Participants contributed descriptions of behaviours, attitudes, and examples related to synchronicity in their work teams. A grounded-theory thematic analysis was conducted, following the steps of open coding, axial coding, and theme clustering. All themes emerged inductively from the dataset.

Findings

Across responses, synchronicity was described not as random coincidence but as a pattern of collective behaviour. The findings suggest that synchronicity is not mystical or accidental—it is an emergent team capacity shaped by intuition, openness, trust, and skilled facilitation. Further research could investigate the impact of synchronicity on innovation, team cohesion, and decision accuracy.`,
  },
  {
    slug: "not-every-expert-is-a-keynote-speaker",
    title: "Not every expert is a Keynote Speaker",
    author: "Dr. Lakshmi Ramachandran", date: "June 7, 2026", categories: "Communication / Voice",
    cover: "https://www.asiaspeakers.org/wp-content/uploads/2026/06/Difference-between-expert-and-a-keynote-speaker-1200x675-1.png",
    excerpt: "A packed conference hall. A brilliant expert on stage. A few minutes in, the energy in the room collapses. This is not a knowledge problem — it is a communication one.",
    body: `What separates the two, and how to close the gap.

The speaker is brilliant. Their credentials are unimpeachable. They know their field better than most others in the room. And yet as they start to speak, the energy in the room goes down and phones come out.

After the talk finishes, people walk away with nothing that will change how they think or what they will do differently.

This is not a knowledge problem. It is a communication problem, which is more common than most experts like to admit.

The difference between speaking as a professional/expert and professional speaking

This is a distinction worth understanding. Anyone with deep knowledge can stand at a podium and share what they know. That is public speaking in its broadest sense: presenting information to a group. This is significantly different from professional keynote speaking.

Let's understand this by pausing on the word "keynote". In music, the keynote sets the tonal foundation for everything that follows. A keynote speaker at an event does the same: they set the tone and the direction for the entire gathering, and they leave the audience in a different, positive place—better informed, inspired and impacted—than when they walked in.

The craft is not in the content alone. It is in how that content is shaped, delivered, and received. Importantly, in how it moves people, not just informs them.

Why brilliant people sometimes lose the room

Experts who struggle on stage are rarely lacking in substance. The gap lies in preparing the talk rather than preparing for the audience—in spending hours on what to say and very little time thinking about who is sitting in that room, what they already believe, what they are hoping for, and what would actually shift something for them.

You lose the audience the moment you treat them as a passive receiver of information rather than an active participant in something worth their full attention.

The single shift that changes everything: from "what do I want to say" to "what does this audience need to receive." That reorientation rewrites the entire preparation process.

Four ways experts can hold the room better

If you are an expert who speaks at conferences, leadership forums, internal events, or client sessions, these are the shifts that make the most consistent difference.

Research the room before you research the topic. Before you finalise a single slide, understand who will be in that room. What do they already know? What are they struggling with? What do they want to walk away with? The best speakers ask these questions before they write a word.

Choose stories before you choose data. Data informs, stories move.

Brilliance without influence is invisible. Closing that gap is one of the most valuable things any expert leader can do.`,
  },
  {
    slug: "how-can-leaders-realise-productivity-gains-in-the-age-of-ai",
    title: "How Can Leaders Realise Productivity Gains in the Age of AI? Highlights from My AI Speech In Singapore",
    author: "Mark Stuart CSP", date: "May 6, 2026", categories: "Digital, Leadership, Management, Technology",
    cover: "https://www.asiaspeakers.org/wp-content/uploads/2026/05/AI-Keynote-Speaker-Singapore-Mark-Stuart-Keynote-Speech-AI-1.png",
    excerpt: "Discover how AI keynote speaker Mark Stuart helps leaders boost productivity in the AI era, from his keynote delivered at Sentosa Cove, Singapore.",
    body: `When Mark Stuart, CSP delivered his keynote, "How Leaders Can Realise Productivity Gains in the Age of AI," at W Hotel Sentosa Cove in Singapore for Allianz on 10 April 2026, the audience was a senior and C-suite audience of insurance leaders — people responsible for strategy, performance, risk, transformation, clients, and the future relevance of their organisations.

The real AI question for leaders today is no longer, "What can the technology do?" The more urgent question is, "How do we convert what the technology can do into measurable business value?"

Across Asia and the world, companies are investing heavily in artificial intelligence, generative AI, automation, and increasingly, agentic AI. In insurance, the opportunity is especially significant. AI can improve underwriting, speed up claims, enhance fraud detection, personalise client engagement, and support advisers with faster insight. McKinsey has reported that AI-enabled rewiring in insurance has already produced measurable improvements, including 10 to 20 per cent improvement in new-agent success and sales conversion rates, 10 to 15 per cent premium growth, 20 to 40 per cent reductions in the cost of onboarding new customers, and 3 to 5 per cent improvements in claims accuracy.

Yet the paradox is clear: while AI can create impressive gains at the task level, many organisations are still struggling to translate those gains into enterprise-wide productivity. As highlighted in the Allianz presentation slides, AI can deliver task-level gains of 14 to 55 per cent, yet many companies are still not seeing meaningful productivity improvements across the organisation. This is the leadership challenge of the AI age.

AI Is Not Just an Efficiency Tool

For many organisations, the first instinct is to treat AI as a faster way to do existing work. Draft the report faster. Summarise the meeting faster. Generate the email faster. Analyse the data faster. While these are useful improvements, they are not transformation.

The keynote made a crucial point: productivity gains only become valuable when saved time is reinvested into better outcomes. If a broker saves three hours preparing a client proposal, but the proposal is merely completed earlier rather than made sharper, more personalised, more persuasive, or more commercially valuable, then the organisation has saved time without creating strategic advantage.

This is where many AI initiatives stall. Employees become more efficient, but the company does not become more competitive. Research supports this tension: MIT Sloan reported that generative AI improved the performance of highly skilled workers by nearly 40 per cent in certain professional tasks.`,
  },
  {
    slug: "the-future-of-work-what-does-it-mean-for-you",
    title: "The Future of Work: What Does It Mean for You?",
    author: "Mark Stuart CSP", date: "April 2, 2025", categories: "Change Management, Innovation/Creativity, Leadership, Strategy",
    cover: "https://www.asiaspeakers.org/wp-content/uploads/2025/04/future-of-work-speaker-singapore-mark-stuart.png",
    excerpt: "The question for all professionals and leaders is no longer whether the future of work is coming, but what it means for you.",
    body: `"You cannot overtake 15 cars in sunny weather… but you can when it's raining." — Ayrton Senna

As the pace of change accelerates across industries, these words from Formula 1 legend Ayrton Senna ring more true than ever. The rain is here: economic uncertainty, technological disruption, workforce upheaval. But therein lies opportunity—for those bold enough to seize it.

In this article, we explore what's driving change this year and beyond, and how you can navigate it using the three-part Future of Work Framework: Data, Technology, and People.

The Macro Forces Reshaping Our Work

From logistics to financial services, healthcare to manufacturing, three macro trends are impacting every sector: industry consolidation through technology, geopolitical risk and supply chain disruption, and workforce transformation.

Digital transformation has become a survival imperative. Companies that lag in tech adoption are being absorbed—or simply left behind. The war in Ukraine, ongoing tensions in the South China Sea, and regional trade disputes have reshaped global supply chains; McKinsey reports that 90% of global supply chain leaders plan to shift or have already shifted sourcing strategies in response to geopolitical instability.

The nature of work itself is changing. Hybrid work, AI collaboration, and skills shortages are pushing leaders to rethink everything from hiring to learning and development. According to PwC's 2024 Global Workforce Hopes and Fears Survey, 53% of employees believe their job will change significantly within the next five years, and 39% are worried they're not getting the training needed to thrive.

Introducing the Future of Work Framework: Data | Technology | People

DATA: The New Language of Work. Data is now one of the most valuable assets in any business—but having it isn't enough. Only 24% of decision-makers say they can access the data they need to make informed decisions (Harvard Business Review), and just 13% of organisations are considered "data mature" (Accenture).

Each element of the framework—Data, Technology, and People—represents a pillar of career resilience and leadership readiness for the years ahead.`,
  },
  {
    slug: "leading-at-the-speed-of-change",
    title: "Leading at the Speed of Change: My Leadership In A Digital Framework",
    author: "Mark Stuart CSP", date: "March 29, 2025", categories: "Change Management, Innovation/Creativity, Leadership, Management",
    cover: "https://www.asiaspeakers.org/wp-content/uploads/2025/03/leadership-speaker-singapore.png",
    excerpt: "Leaders today are not only expected to manage teams but also navigate an increasingly digital and fast-changing landscape.",
    body: `The rapid evolution of technology is redefining the world of work. Leaders today are not only expected to manage teams but also navigate an increasingly digital and fast-changing landscape. Whether leading a multinational corporation or a small enterprise, staying ahead requires a new mindset and a fresh set of skills.

Through work with over 700 companies in 22 countries, the Leadership in a Digital Age (LIDA) Framework was developed to help leaders adapt and thrive in this era of transformation.

Learning: Staying Ahead in an Era of Continuous Change

The only constant in today's world is change. A 2023 report by the World Economic Forum estimates that 44% of workers' skills will be disrupted by 2027, with nearly one billion people needing to reskill to remain relevant in their industries. Learning is no longer a one-time event but an ongoing process.

To be future-ready, leaders must commit to lifelong learning, encourage a culture of learning within their organisations, and embrace unlearning and relearning. According to a LinkedIn Workplace Learning Report, 94% of employees would stay at a company longer if it invested in their learning and development.

Innovation: Building a Culture of Creativity and Continuous Improvement

Innovation is no longer optional; it is a necessity for survival. Research from McKinsey shows that companies with a strong innovation strategy grow 2.4 times faster than their peers. However, innovation is not just about creating new products—it is about rethinking processes, improving customer experience, and fostering a culture that encourages new ideas.

To lead innovation, leaders should empower teams to think creatively, encourage risk-taking and reward bold ideas, and enhance customer and user experience. Research from PwC indicates that 73% of consumers say a good experience is a key factor in their purchasing decisions.`,
  },
];

async function upsertBlogCollection() {
  const payload = {
    site_id: site.id, tenant_id: tenant.id, name: "Blog", slug: "blog",
    description: "Articles from APSS members.",
    fields: [
      { key: "cover", label: "Cover image", type: "image", required: false },
      { key: "categories", label: "Category", type: "text", required: false },
      { key: "meta", label: "Byline (author · date)", type: "text", required: false },
      { key: "excerpt", label: "Excerpt", type: "text", required: false },
      { key: "body", label: "Body", type: "textarea", required: true },
    ],
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase.from("website_collections").select("id").eq("site_id", site.id).eq("slug", "blog").maybeSingle();
  if (existing) { await supabase.from("website_collections").update(payload).eq("id", existing.id); return existing.id; }
  const { data, error } = await supabase.from("website_collections").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

async function upsertBlogPost(collectionId, post) {
  const payload = {
    collection_id: collectionId, tenant_id: tenant.id, slug: post.slug, title: post.title, status: "published",
    data: { cover: post.cover, categories: post.categories, meta: `By ${post.author} · ${post.date}`, excerpt: post.excerpt, body: post.body },
    published_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase.from("website_collection_entries").select("id").eq("collection_id", collectionId).eq("slug", post.slug).maybeSingle();
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

async function upsertPage({ name, path, kind, document, title, description, collectionId = null }) {
  const base = {
    site_id: site.id, tenant_id: tenant.id, name, path, kind, title, description,
    collection_id: collectionId, document, status: "published", created_by: userId, updated_at: new Date().toISOString(),
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
const collectionId = await upsertSpeakersCollection();
for (const speaker of SPEAKERS) await upsertSpeaker(collectionId, speaker);
const blogCollectionId = await upsertBlogCollection();
for (const post of BLOG_POSTS) await upsertBlogPost(blogCollectionId, post);

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
  name: "Blog", path: "/blog", kind: "page", title: "The APSS blog",
  description: "Read exclusive content from our members here on the blog.",
  document: buildDocument(blogTree(blogCollectionId)),
});
await upsertPage({
  name: "Blog post", path: "/blog/:slug", kind: "collection_template", title: "APSS blog",
  description: "An article from the APSS blog.", collectionId: blogCollectionId,
  document: buildDocument(blogPostTree()),
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
  site: "APSS", speakers: SPEAKERS.length, blogPosts: BLOG_POSTS.length,
  pages: ["/", "/about", "/speakers", "/blog", "/blog/:slug", "/join", "/contact"],
  publicUrls: [`${origin}/${SITE_SLUG}`, `${origin}/${SITE_SLUG}/speakers`, `${origin}/${SITE_SLUG}/blog`, `${origin}/${SITE_SLUG}/blog/${BLOG_POSTS[0].slug}`],
}, null, 2));
