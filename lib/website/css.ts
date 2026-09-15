import { BASE_BREAKPOINT_ID, type Breakpoint, type StyleDecl, type WebsiteDocument } from "@/lib/website/schema";

// Style sources compile to classes. An instance wears the classes of every style source
// selected for it, so shared tokens and per-instance overrides cascade naturally.

const SAFE_PROPERTY = /^[a-z-]+$/;
const SAFE_STATE = /^[a-z-:()\s]+$/;

/** Style values land inside a stylesheet, so anything that could close the rule or open a tag is rejected. */
function sanitizeValue(value: string) {
  return value.replaceAll(/[<>{}\\]/g, "").replaceAll(/@import/gi, "").trim();
}

export function styleSourceClassName(styleSourceId: string) {
  return `wss-${styleSourceId.replaceAll(/[^A-Za-z0-9_-]/g, "")}`;
}

export function instanceClassNames(document: WebsiteDocument, instanceId: string) {
  const selection = document.styleSourceSelections.find((entry) => entry.instanceId === instanceId);
  return (selection?.values ?? []).map(styleSourceClassName).join(" ");
}

function sortBreakpoints(breakpoints: Breakpoint[]) {
  // Mobile-first: the base breakpoint has no min-width and must be emitted first so the
  // wider media queries can override it.
  return [...breakpoints].sort((a, b) => (a.minWidth ?? 0) - (b.minWidth ?? 0));
}

function declarationsToCss(declarations: StyleDecl[]) {
  const byTarget = new Map<string, string[]>();
  for (const declaration of declarations) {
    if (!SAFE_PROPERTY.test(declaration.property)) continue;
    if (declaration.state && !SAFE_STATE.test(declaration.state)) continue;
    const value = sanitizeValue(declaration.value);
    if (!value) continue;
    const selector = `.${styleSourceClassName(declaration.styleSourceId)}${declaration.state ?? ""}`;
    const bucket = byTarget.get(selector) ?? [];
    bucket.push(`${declaration.property}:${value}`);
    byTarget.set(selector, bucket);
  }
  return [...byTarget.entries()]
    .map(([selector, properties]) => `${selector}{${properties.join(";")}}`)
    .join("");
}

/** Compiles a document's style declarations into a single stylesheet string. */
export function renderDocumentCss(document: WebsiteDocument) {
  const blocks: string[] = [];
  for (const breakpoint of sortBreakpoints(document.breakpoints)) {
    const declarations = document.styles.filter((style) => style.breakpointId === breakpoint.id);
    if (!declarations.length) continue;
    const css = declarationsToCss(declarations);
    if (!css) continue;
    blocks.push(
      breakpoint.id === BASE_BREAKPOINT_ID || !breakpoint.minWidth
        ? css
        : `@media (min-width:${breakpoint.minWidth}px){${css}}`,
    );
  }
  return blocks.join("");
}
