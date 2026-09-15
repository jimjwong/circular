import { componentMeta } from "@/lib/website/components";
import { BASE_BREAKPOINT_ID, createId, type Instance, type WebsiteDocument } from "@/lib/website/schema";

// Pure document transforms. The builder keeps the whole document in React state and
// replaces it wholesale on every edit, so each of these returns a new document and never
// mutates its input.

function clone(document: WebsiteDocument): WebsiteDocument {
  return {
    ...document,
    roots: [...document.roots],
    instances: document.instances.map((instance) => ({ ...instance, children: [...instance.children] })),
    props: document.props.map((prop) => ({ ...prop })),
    styleSources: document.styleSources.map((source) => ({ ...source })),
    styleSourceSelections: document.styleSourceSelections.map((selection) => ({ ...selection, values: [...selection.values] })),
    styles: document.styles.map((style) => ({ ...style })),
    breakpoints: document.breakpoints.map((breakpoint) => ({ ...breakpoint })),
    dataSources: document.dataSources.map((source) => ({ ...source })),
  };
}

export function findInstance(document: WebsiteDocument, instanceId: string) {
  return document.instances.find((instance) => instance.id === instanceId);
}

export function parentOf(document: WebsiteDocument, instanceId: string) {
  return document.instances.find((instance) =>
    instance.children.some((child) => child.type === "id" && child.value === instanceId));
}

/** Guards against dropping a container into its own subtree. */
export function isDescendant(document: WebsiteDocument, ancestorId: string, candidateId: string): boolean {
  const ancestor = findInstance(document, ancestorId);
  if (!ancestor) return false;
  for (const child of ancestor.children) {
    if (child.type !== "id") continue;
    if (child.value === candidateId) return true;
    if (isDescendant(document, child.value, candidateId)) return true;
  }
  return false;
}

function detach(document: WebsiteDocument, instanceId: string) {
  document.roots = document.roots.filter((rootId) => rootId !== instanceId);
  for (const instance of document.instances) {
    instance.children = instance.children.filter((child) => !(child.type === "id" && child.value === instanceId));
  }
}

function attach(document: WebsiteDocument, instanceId: string, parentId: string | null, index: number) {
  if (parentId === null) {
    const position = Math.min(Math.max(index, 0), document.roots.length);
    document.roots.splice(position, 0, instanceId);
    return;
  }
  const parent = findInstance(document, parentId);
  if (!parent) return;
  const position = Math.min(Math.max(index, 0), parent.children.length);
  parent.children.splice(position, 0, { type: "id", value: instanceId });
}

export function insertComponent(
  document: WebsiteDocument,
  component: string,
  parentId: string | null,
  index: number,
): { document: WebsiteDocument; instanceId: string } {
  const meta = componentMeta(component);
  const next = clone(document);
  const instanceId = createId("i");
  const styleSourceId = createId("s");

  const instance: Instance = { id: instanceId, component, children: [] };
  if (meta?.defaultText !== undefined) instance.children.push({ type: "text", value: meta.defaultText });
  next.instances.push(instance);

  next.styleSources.push({ id: styleSourceId, type: "local" });
  next.styleSourceSelections.push({ instanceId, values: [styleSourceId] });

  for (const [name, value] of Object.entries(meta?.defaultProps ?? {})) {
    if (value === undefined) continue;
    next.props.push({
      id: createId("p"), instanceId, name,
      type: typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string",
      value,
    });
  }

  // A freshly dropped container needs visible bounds, otherwise it collapses to nothing
  // and cannot be targeted again.
  if (meta?.acceptsChildren) {
    next.styles.push({ breakpointId: BASE_BREAKPOINT_ID, styleSourceId, property: "min-height", value: "60px" });
    next.styles.push({ breakpointId: BASE_BREAKPOINT_ID, styleSourceId, property: "padding", value: "16px" });
  }

  attach(next, instanceId, parentId, index);
  return { document: next, instanceId };
}

export function moveInstance(document: WebsiteDocument, instanceId: string, parentId: string | null, index: number) {
  if (parentId === instanceId || (parentId && isDescendant(document, instanceId, parentId))) return document;
  const next = clone(document);

  // Removing first shifts later positions in the same parent down by one.
  const previousParent = parentOf(next, instanceId);
  const sameParent = (previousParent?.id ?? null) === parentId;
  let target = index;
  if (sameParent) {
    const siblings = parentId ? previousParent!.children : next.roots.map((id) => ({ type: "id" as const, value: id }));
    const current = siblings.findIndex((child) => (typeof child === "string" ? child : child.value) === instanceId);
    if (current > -1 && current < index) target -= 1;
  }

  detach(next, instanceId);
  attach(next, instanceId, parentId, target);
  return next;
}

export function removeInstance(document: WebsiteDocument, instanceId: string) {
  const next = clone(document);
  const doomed = new Set<string>();

  const collect = (id: string) => {
    doomed.add(id);
    const instance = findInstance(next, id);
    for (const child of instance?.children ?? []) if (child.type === "id") collect(child.value);
  };
  collect(instanceId);

  detach(next, instanceId);
  next.instances = next.instances.filter((instance) => !doomed.has(instance.id));
  next.props = next.props.filter((prop) => !doomed.has(prop.instanceId));

  const orphanedSources = new Set(next.styleSourceSelections
    .filter((selection) => doomed.has(selection.instanceId))
    .flatMap((selection) => selection.values));
  next.styleSourceSelections = next.styleSourceSelections.filter((selection) => !doomed.has(selection.instanceId));
  // A token may still be worn by a surviving instance, so only drop unreferenced sources.
  const stillUsed = new Set(next.styleSourceSelections.flatMap((selection) => selection.values));
  const removable = [...orphanedSources].filter((id) => !stillUsed.has(id));
  next.styleSources = next.styleSources.filter((source) => !removable.includes(source.id));
  next.styles = next.styles.filter((style) => !removable.includes(style.styleSourceId));

  return next;
}

export function duplicateInstance(document: WebsiteDocument, instanceId: string) {
  const parent = parentOf(document, instanceId);
  const siblings = parent ? parent.children.filter((child) => child.type === "id").map((child) => child.value) : document.roots;
  const index = siblings.indexOf(instanceId);

  let next = clone(document);
  const copy = (sourceId: string, targetParent: string | null, targetIndex: number): string | null => {
    const source = findInstance(next, sourceId);
    if (!source) return null;
    const newId = createId("i");
    const styleSourceId = createId("s");

    next.instances.push({ ...source, id: newId, children: [] });
    next.styleSources.push({ id: styleSourceId, type: "local" });
    next.styleSourceSelections.push({ instanceId: newId, values: [styleSourceId] });

    const sourceSelection = next.styleSourceSelections.find((selection) => selection.instanceId === sourceId);
    for (const sourceStyleId of sourceSelection?.values ?? []) {
      for (const style of next.styles.filter((candidate) => candidate.styleSourceId === sourceStyleId)) {
        next.styles.push({ ...style, styleSourceId });
      }
    }
    for (const prop of next.props.filter((candidate) => candidate.instanceId === sourceId)) {
      next.props.push({ ...prop, id: createId("p"), instanceId: newId });
    }

    const target = findInstance(next, newId)!;
    for (const child of source.children) {
      if (child.type !== "id") { target.children.push({ ...child }); continue; }
      const childId = copy(child.value, newId, target.children.length);
      if (childId) target.children.push({ type: "id", value: childId });
    }

    attach(next, newId, targetParent, targetIndex);
    return newId;
  };

  const newId = copy(instanceId, parent?.id ?? null, index + 1);
  if (!newId) next = clone(document);
  return { document: next, instanceId: newId };
}

export function setInstanceText(document: WebsiteDocument, instanceId: string, value: string) {
  const next = clone(document);
  const instance = findInstance(next, instanceId);
  if (!instance) return next;
  const textIndex = instance.children.findIndex((child) => child.type === "text");
  if (textIndex > -1) instance.children[textIndex] = { type: "text", value };
  else instance.children.unshift({ type: "text", value });
  return next;
}

export function instanceText(document: WebsiteDocument, instanceId: string) {
  const instance = findInstance(document, instanceId);
  const child = instance?.children.find((candidate) => candidate.type === "text");
  return child?.type === "text" ? child.value : "";
}

export function setInstanceProp(document: WebsiteDocument, instanceId: string, name: string, value: string | number | boolean) {
  const next = clone(document);
  const existing = next.props.find((prop) => prop.instanceId === instanceId && prop.name === name);
  const type = typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
  if (existing) { existing.value = value; existing.type = type; }
  else next.props.push({ id: createId("p"), instanceId, name, type, value });
  return next;
}

export function instanceProps(document: WebsiteDocument, instanceId: string) {
  const meta = componentMeta(findInstance(document, instanceId)?.component ?? "");
  const resolved: Record<string, string | number | boolean | undefined> = { ...(meta?.defaultProps ?? {}) };
  for (const prop of document.props) if (prop.instanceId === instanceId) resolved[prop.name] = prop.value;
  return resolved;
}

/** The local style source an instance owns, creating one if the instance has none. */
function localStyleSourceId(document: WebsiteDocument, instanceId: string) {
  const selection = document.styleSourceSelections.find((entry) => entry.instanceId === instanceId);
  const existing = selection?.values.find((id) =>
    document.styleSources.find((source) => source.id === id && source.type === "local"));
  if (existing) return existing;

  const styleSourceId = createId("s");
  document.styleSources.push({ id: styleSourceId, type: "local" });
  if (selection) selection.values.push(styleSourceId);
  else document.styleSourceSelections.push({ instanceId, values: [styleSourceId] });
  return styleSourceId;
}

export function setInstanceStyle(
  document: WebsiteDocument,
  instanceId: string,
  breakpointId: string,
  property: string,
  value: string,
) {
  const next = clone(document);
  const styleSourceId = localStyleSourceId(next, instanceId);
  const index = next.styles.findIndex((style) =>
    style.styleSourceId === styleSourceId && style.breakpointId === breakpointId && style.property === property && !style.state);

  if (!value.trim()) {
    if (index > -1) next.styles.splice(index, 1);
    return next;
  }
  if (index > -1) next.styles[index] = { ...next.styles[index], value };
  else next.styles.push({ breakpointId, styleSourceId, property, value });
  return next;
}

/** Reads the value shown in the style panel: the breakpoint's own value, not an inherited one. */
export function instanceStyle(document: WebsiteDocument, instanceId: string, breakpointId: string, property: string) {
  const selection = document.styleSourceSelections.find((entry) => entry.instanceId === instanceId);
  for (const styleSourceId of selection?.values ?? []) {
    const style = document.styles.find((candidate) =>
      candidate.styleSourceId === styleSourceId && candidate.breakpointId === breakpointId && candidate.property === property && !candidate.state);
    if (style) return style.value;
  }
  return "";
}
