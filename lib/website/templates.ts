// Imported relatively rather than through the "@/" alias because scripts/seed-website-demo.mjs
// loads this module with bare Node, which does not resolve the tsconfig path alias.
import type { RenderedProps } from "./components.tsx";
import {
  BASE_BREAKPOINT_ID, createId, DEFAULT_BREAKPOINTS,
  type Instance, type Prop, type StyleDecl, type StyleSource, type StyleSourceSelection, type WebsiteDocument,
} from "./schema.ts";

export type TemplateNode = {
  component: string;
  text?: string;
  props?: RenderedProps;
  /** Base-breakpoint CSS for this node, written as plain property/value pairs. */
  style?: Record<string, string>;
  /** Overrides applied at the desktop breakpoint. */
  desktopStyle?: Record<string, string>;
  children?: TemplateNode[];
};

/**
 * Expands a nested template into the flat document shape. Authoring templates as a tree
 * keeps them readable; the document stays flat so the builder can move a subtree by
 * rewriting a single child reference.
 */
export function buildDocument(nodes: TemplateNode[]): WebsiteDocument {
  const instances: Instance[] = [];
  const props: Prop[] = [];
  const styleSources: StyleSource[] = [];
  const styleSourceSelections: StyleSourceSelection[] = [];
  const styles: StyleDecl[] = [];

  function walk(node: TemplateNode): string {
    const instanceId = createId("i");
    const styleSourceId = createId("s");
    styleSources.push({ id: styleSourceId, type: "local" });
    styleSourceSelections.push({ instanceId, values: [styleSourceId] });

    for (const [property, value] of Object.entries(node.style ?? {})) {
      styles.push({ breakpointId: BASE_BREAKPOINT_ID, styleSourceId, property, value });
    }
    for (const [property, value] of Object.entries(node.desktopStyle ?? {})) {
      styles.push({ breakpointId: "desktop", styleSourceId, property, value });
    }
    for (const [name, value] of Object.entries(node.props ?? {})) {
      if (value === undefined) continue;
      props.push({ id: createId("p"), instanceId, name, type: typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string", value });
    }

    const children: Instance["children"] = [];
    if (node.text !== undefined) children.push({ type: "text", value: node.text });
    for (const child of node.children ?? []) children.push({ type: "id", value: walk(child) });

    instances.push({ id: instanceId, component: node.component, children });
    return instanceId;
  }

  const roots = nodes.map(walk);
  return {
    version: 1,
    roots,
    instances,
    props,
    styleSources,
    styleSourceSelections,
    styles,
    breakpoints: DEFAULT_BREAKPOINTS.map((breakpoint) => ({ ...breakpoint })),
    dataSources: [],
  };
}

const HEADING_STYLE = { "font-size": "32px", "line-height": "1.15", "font-weight": "700", margin: "0 0 16px", color: "#18251f" };
const BODY_STYLE = { "font-size": "16px", "line-height": "1.7", color: "#5f7066", margin: "0 0 20px" };
const SECTION_STYLE = { padding: "64px 24px", "background-color": "#ffffff" };
const CONTAINER_STYLE = { "max-width": "1040px", margin: "0 auto" };
const BUTTON_STYLE = {
  display: "inline-block", padding: "14px 26px", "border-radius": "12px",
  "background-color": "#183f30", color: "#ffffff", "font-weight": "700",
  "font-size": "14px", "text-decoration": "none",
};

function hero(eyebrow: string, heading: string, body: string, cta: string): TemplateNode {
  return {
    component: "Section",
    style: { ...SECTION_STYLE, "background-color": "#173f31", padding: "80px 24px", "text-align": "center" },
    desktopStyle: { padding: "120px 24px" },
    children: [{
      component: "Container",
      style: { ...CONTAINER_STYLE, "max-width": "720px" },
      children: [
        { component: "Eyebrow", text: eyebrow, style: { "font-size": "12px", "font-weight": "700", "letter-spacing": "0.18em", "text-transform": "uppercase", color: "#efc77f" } },
        { component: "Heading", text: heading, props: { level: "h1" }, style: { ...HEADING_STYLE, color: "#ffffff", "font-size": "40px", margin: "20px 0 16px" }, desktopStyle: { "font-size": "56px" } },
        { component: "Text", text: body, style: { ...BODY_STYLE, color: "#c3d5cc", "font-size": "17px" } },
        { component: "Button", text: cta, props: { href: "#join", target: "_self" }, style: { ...BUTTON_STYLE, "background-color": "#f1c983", color: "#183f30" } },
      ],
    }],
  };
}

export type TemplateId = "blank" | "landing" | "event" | "funnel" | "collection";

export const PAGE_TEMPLATES: Record<TemplateId, { label: string; description: string; kind: string; build: () => WebsiteDocument }> = {
  blank: {
    label: "Blank page",
    description: "An empty section to build from.",
    kind: "page",
    build: () => buildDocument([{
      component: "Section", style: SECTION_STYLE,
      children: [{
        component: "Container", style: CONTAINER_STYLE,
        children: [
          { component: "Heading", text: "New page", props: { level: "h1" }, style: HEADING_STYLE },
          { component: "Text", text: "Drag components from the left panel to start building.", style: BODY_STYLE },
        ],
      }],
    }]),
  },
  landing: {
    label: "Landing page",
    description: "Hero, benefits grid, and a signup call to action.",
    kind: "landing",
    build: () => buildDocument([
      hero("Welcome", "Build meaningful work, together.", "A private community for people turning ideas into enduring businesses.", "Join the community"),
      {
        component: "Section", style: SECTION_STYLE,
        children: [{
          component: "Container", style: CONTAINER_STYLE,
          children: [
            { component: "Heading", text: "What you get", style: { ...HEADING_STYLE, "text-align": "center" } },
            {
              component: "Grid", props: { columns: 3 },
              style: { gap: "20px", "grid-template-columns": "1fr", "margin-top": "32px" },
              desktopStyle: { "grid-template-columns": "repeat(3, minmax(0, 1fr))" },
              children: [
                { component: "Container", style: { padding: "24px", "border-radius": "18px", "background-color": "#f5f8f6" }, children: [
                  { component: "Heading", text: "Weekly workshops", props: { level: "h3" }, style: { ...HEADING_STYLE, "font-size": "18px", margin: "0 0 8px" } },
                  { component: "Text", text: "Live sessions with practitioners every week.", style: { ...BODY_STYLE, margin: "0" } },
                ] },
                { component: "Container", style: { padding: "24px", "border-radius": "18px", "background-color": "#f5f8f6" }, children: [
                  { component: "Heading", text: "Peer circles", props: { level: "h3" }, style: { ...HEADING_STYLE, "font-size": "18px", margin: "0 0 8px" } },
                  { component: "Text", text: "Small accountability groups matched to your goals.", style: { ...BODY_STYLE, margin: "0" } },
                ] },
                { component: "Container", style: { padding: "24px", "border-radius": "18px", "background-color": "#f5f8f6" }, children: [
                  { component: "Heading", text: "Courses", props: { level: "h3" }, style: { ...HEADING_STYLE, "font-size": "18px", margin: "0 0 8px" } },
                  { component: "Text", text: "Structured programmes with verifiable credentials.", style: { ...BODY_STYLE, margin: "0" } },
                ] },
              ],
            },
          ],
        }],
      },
      {
        component: "Section", style: { ...SECTION_STYLE, "background-color": "#f5f8f6", "text-align": "center" },
        children: [{ component: "Container", style: CONTAINER_STYLE, children: [
          { component: "MemberSignup", props: { heading: "Ready to join?", buttonLabel: "Create your account" } },
        ] }],
      },
    ]),
  },
  event: {
    label: "Event page",
    description: "Event hero with the upcoming schedule pulled from Commune.",
    kind: "event",
    build: () => buildDocument([
      hero("Event", "An evening with the community", "Join us for talks, workshops, and conversation.", "Reserve your place"),
      {
        component: "Section", style: SECTION_STYLE,
        children: [{ component: "Container", style: CONTAINER_STYLE, children: [
          { component: "EventList", props: { heading: "Upcoming events", limit: 4 }, style: { display: "block" } },
        ] }],
      },
    ]),
  },
  funnel: {
    label: "Funnel step",
    description: "Single-offer page with a focused form.",
    kind: "funnel",
    build: () => buildDocument([
      hero("Limited offer", "Get the playbook", "Everything we have learned about building a community that lasts.", "Send it to me"),
      {
        component: "Section", style: { ...SECTION_STYLE, "background-color": "#f5f8f6" },
        children: [{
          component: "Container", style: { ...CONTAINER_STYLE, "max-width": "520px" },
          children: [{
            component: "Form", props: { submitLabel: "Get instant access" },
            style: { display: "flex", "flex-direction": "column", gap: "14px", padding: "28px", "background-color": "#ffffff", "border-radius": "20px" },
            children: [
              { component: "Input", props: { label: "Your name", name: "name", inputType: "text", required: true } },
              { component: "Input", props: { label: "Work email", name: "email", inputType: "email", required: true } },
            ],
          }],
        }],
      },
    ]),
  },
  collection: {
    label: "Collection template",
    description: "Renders one CMS entry; pair it with a path such as /blog/:slug.",
    kind: "collection_template",
    build: () => buildDocument([{
      component: "Section", style: SECTION_STYLE,
      children: [{
        component: "Container", style: { ...CONTAINER_STYLE, "max-width": "720px" },
        children: [
          { component: "CollectionField", props: { field: "title" }, style: { "font-size": "36px", "font-weight": "700", display: "block", "margin-bottom": "16px" } },
          { component: "CollectionField", props: { field: "body" }, style: { ...BODY_STYLE, display: "block" } },
        ],
      }],
    }]),
  },
};
