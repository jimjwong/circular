import { z } from "zod";

// The page document keeps instances, props, and styles in separate flat collections
// rather than one nested tree. That split is what lets a single style source be shared
// by many instances and overridden per breakpoint without duplicating style data.

const idSchema = z.string().min(1).max(64);

export const breakpointSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(40),
  // Absent on the base breakpoint, which is the mobile-first default.
  minWidth: z.number().int().min(1).max(4096).optional(),
});

export const instanceChildSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("id"), value: idSchema }),
  z.object({ type: z.literal("text"), value: z.string().max(20000) }),
  z.object({ type: z.literal("expression"), value: z.string().max(400) }),
]);

export const instanceSchema = z.object({
  id: idSchema,
  component: z.string().min(1).max(60),
  label: z.string().max(80).optional(),
  children: z.array(instanceChildSchema).max(200).default([]),
});

export const propSchema = z.object({
  id: idSchema,
  instanceId: idSchema,
  name: z.string().min(1).max(60),
  type: z.enum(["string", "number", "boolean", "asset", "page", "expression"]),
  value: z.union([z.string().max(20000), z.number(), z.boolean()]),
});

export const styleSourceSchema = z.object({
  id: idSchema,
  // 'local' styles belong to a single instance; 'token' styles are reusable across the site.
  type: z.enum(["token", "local"]),
  name: z.string().max(60).optional(),
});

export const styleSourceSelectionSchema = z.object({
  instanceId: idSchema,
  values: z.array(idSchema).max(20).default([]),
});

export const styleDeclSchema = z.object({
  breakpointId: idSchema,
  styleSourceId: idSchema,
  state: z.string().max(40).optional(),
  property: z.string().min(1).max(60),
  value: z.string().max(400),
});

export const dataSourceSchema = z.object({
  id: idSchema,
  type: z.enum(["collection", "parameter", "variable"]),
  name: z.string().min(1).max(60),
  collectionId: z.uuid().optional(),
  scopeInstanceId: idSchema.optional(),
  value: z.string().max(400).optional(),
});

export const websiteDocumentSchema = z.object({
  version: z.literal(1),
  roots: z.array(idSchema).max(50).default([]),
  instances: z.array(instanceSchema).max(2000).default([]),
  props: z.array(propSchema).max(4000).default([]),
  styleSources: z.array(styleSourceSchema).max(2000).default([]),
  styleSourceSelections: z.array(styleSourceSelectionSchema).max(2000).default([]),
  styles: z.array(styleDeclSchema).max(20000).default([]),
  breakpoints: z.array(breakpointSchema).min(1).max(10),
  dataSources: z.array(dataSourceSchema).max(100).default([]),
});

export type Breakpoint = z.infer<typeof breakpointSchema>;
export type InstanceChild = z.infer<typeof instanceChildSchema>;
export type Instance = z.infer<typeof instanceSchema>;
export type Prop = z.infer<typeof propSchema>;
export type StyleSource = z.infer<typeof styleSourceSchema>;
export type StyleSourceSelection = z.infer<typeof styleSourceSelectionSchema>;
export type StyleDecl = z.infer<typeof styleDeclSchema>;
export type DataSource = z.infer<typeof dataSourceSchema>;
export type WebsiteDocument = z.infer<typeof websiteDocumentSchema>;

export const BASE_BREAKPOINT_ID = "base";

export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { id: BASE_BREAKPOINT_ID, label: "Mobile" },
  { id: "tablet", label: "Tablet", minWidth: 768 },
  { id: "desktop", label: "Desktop", minWidth: 1024 },
];

export function emptyDocument(): WebsiteDocument {
  return {
    version: 1,
    roots: [],
    instances: [],
    props: [],
    styleSources: [],
    styleSourceSelections: [],
    styles: [],
    breakpoints: DEFAULT_BREAKPOINTS.map((breakpoint) => ({ ...breakpoint })),
    dataSources: [],
  };
}

/**
 * Parses a document loaded from the database. Stored documents are written by our own
 * actions, but a row can predate a schema change, so a failed parse degrades to an
 * empty page instead of taking the whole site down.
 */
export function parseDocument(value: unknown): WebsiteDocument {
  const result = websiteDocumentSchema.safeParse(value);
  return result.success ? result.data : emptyDocument();
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
