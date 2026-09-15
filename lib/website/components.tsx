import type { ReactNode } from "react";
import {
  AlignLeft, Baseline, Box, CalendarDays, Columns3, CreditCard, GraduationCap, Heading1,
  Image as ImageIcon, Layout, Link2, List, Minus, MousePointerClick, Move, Quote, Rows3,
  Send, SquareStack, Tag, Type, UserRoundPlus,
  type LucideIcon,
} from "lucide-react";

export type PropFieldType = "text" | "textarea" | "url" | "select" | "number" | "boolean" | "asset" | "collection";

export type PropField = {
  key: string;
  label: string;
  type: PropFieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
};

export type RenderedProps = Record<string, string | number | boolean | undefined>;

export type ComponentMeta = {
  label: string;
  category: "Layout" | "Content" | "Media" | "Forms" | "Commune";
  icon: LucideIcon;
  acceptsChildren: boolean;
  /** Text components edit their first text child directly rather than through a prop. */
  editableText?: boolean;
  defaultProps?: RenderedProps;
  defaultText?: string;
  fields: PropField[];
  render: (args: { props: RenderedProps; children: ReactNode; className: string }) => ReactNode;
};

const LINK_FIELDS: PropField[] = [
  { key: "href", label: "Link URL", type: "url", placeholder: "https://example.com" },
  { key: "target", label: "Open in", type: "select", options: [
    { value: "_self", label: "Same tab" },
    { value: "_blank", label: "New tab" },
  ] },
];

const text = (value: unknown, fallback = "") => (typeof value === "string" && value.trim() ? value : fallback);

/** Only http(s) links are emitted, so a stored value can never become a javascript: URL. */
export function safeHref(value: unknown) {
  const href = text(value);
  if (!href) return undefined;
  if (href.startsWith("/") || href.startsWith("#")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export const WEBSITE_COMPONENTS: Record<string, ComponentMeta> = {
  Section: {
    label: "Section", category: "Layout", icon: Layout, acceptsChildren: true,
    fields: [{ key: "tag", label: "HTML tag", type: "select", options: [
      { value: "section", label: "section" }, { value: "header", label: "header" },
      { value: "footer", label: "footer" }, { value: "main", label: "main" },
    ] }],
    render: ({ props, children, className }) => {
      const Tag = (["section", "header", "footer", "main"].includes(String(props.tag)) ? props.tag : "section") as "section";
      return <Tag className={className}>{children}</Tag>;
    },
  },
  Container: {
    label: "Container", category: "Layout", icon: Box, acceptsChildren: true, fields: [],
    render: ({ children, className }) => <div className={className}>{children}</div>,
  },
  Grid: {
    label: "Grid", category: "Layout", icon: Columns3, acceptsChildren: true,
    defaultProps: { columns: 3 },
    fields: [{ key: "columns", label: "Columns", type: "number" }],
    render: ({ props, children, className }) => {
      const columns = Math.min(Math.max(Number(props.columns) || 3, 1), 6);
      return <div className={className} style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{children}</div>;
    },
  },
  Stack: {
    label: "Stack", category: "Layout", icon: Rows3, acceptsChildren: true, fields: [],
    render: ({ children, className }) => <div className={className} style={{ display: "flex", flexDirection: "column" }}>{children}</div>,
  },
  Spacer: {
    label: "Spacer", category: "Layout", icon: Move, acceptsChildren: false,
    defaultProps: { height: 48 },
    fields: [{ key: "height", label: "Height (px)", type: "number" }],
    render: ({ props, className }) => <div className={className} style={{ height: `${Math.min(Math.max(Number(props.height) || 48, 1), 600)}px` }} aria-hidden />,
  },
  Divider: {
    label: "Divider", category: "Layout", icon: Minus, acceptsChildren: false, fields: [],
    render: ({ className }) => <hr className={className} />,
  },

  Heading: {
    label: "Heading", category: "Content", icon: Heading1, acceptsChildren: false, editableText: true,
    defaultProps: { level: "h2" }, defaultText: "Your headline goes here",
    fields: [{ key: "level", label: "Level", type: "select", options: [
      { value: "h1", label: "H1" }, { value: "h2", label: "H2" }, { value: "h3", label: "H3" }, { value: "h4", label: "H4" },
    ] }],
    render: ({ props, children, className }) => {
      const Tag = (["h1", "h2", "h3", "h4"].includes(String(props.level)) ? props.level : "h2") as "h2";
      return <Tag className={className}>{children}</Tag>;
    },
  },
  Text: {
    label: "Text", category: "Content", icon: Type, acceptsChildren: false, editableText: true,
    defaultText: "Write something meaningful about your community.",
    fields: [],
    render: ({ children, className }) => <p className={className}>{children}</p>,
  },
  Eyebrow: {
    label: "Eyebrow", category: "Content", icon: Tag, acceptsChildren: false, editableText: true,
    defaultText: "Introducing",
    fields: [],
    render: ({ children, className }) => <span className={className}>{children}</span>,
  },
  Quote: {
    label: "Quote", category: "Content", icon: Quote, acceptsChildren: false, editableText: true,
    defaultText: "This community changed how I work.",
    fields: [{ key: "cite", label: "Attribution", type: "text" }],
    render: ({ props, children, className }) => (
      <figure className={className}>
        <blockquote>{children}</blockquote>
        {text(props.cite) && <figcaption>{text(props.cite)}</figcaption>}
      </figure>
    ),
  },
  RichText: {
    label: "Rich text", category: "Content", icon: AlignLeft, acceptsChildren: false, editableText: true,
    defaultText: "Add a longer passage here.\n\nBlank lines become paragraphs.",
    fields: [],
    render: ({ children, className }) => {
      // Children arrive as plain text; paragraphs are split rather than parsed as HTML
      // so author content can never inject markup.
      const value = typeof children === "string" ? children : "";
      return <div className={className}>{value.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>;
    },
  },
  Button: {
    label: "Button", category: "Content", icon: MousePointerClick, acceptsChildren: false, editableText: true,
    defaultText: "Join the community", defaultProps: { href: "#", target: "_self" },
    fields: LINK_FIELDS,
    render: ({ props, children, className }) => {
      const href = safeHref(props.href);
      return href
        ? <a className={className} href={href} target={props.target === "_blank" ? "_blank" : undefined} rel={props.target === "_blank" ? "noreferrer" : undefined}>{children}</a>
        : <span className={className}>{children}</span>;
    },
  },
  Link: {
    label: "Link", category: "Content", icon: Link2, acceptsChildren: false, editableText: true,
    defaultText: "Learn more", defaultProps: { href: "#", target: "_self" },
    fields: LINK_FIELDS,
    render: ({ props, children, className }) => {
      const href = safeHref(props.href);
      return <a className={className} href={href ?? "#"} target={props.target === "_blank" ? "_blank" : undefined} rel={props.target === "_blank" ? "noreferrer" : undefined}>{children}</a>;
    },
  },
  Image: {
    label: "Image", category: "Media", icon: ImageIcon, acceptsChildren: false,
    fields: [
      { key: "src", label: "Image", type: "asset" },
      { key: "alt", label: "Alt text", type: "text", placeholder: "Describe the image" },
    ],
    render: ({ props, className }) => {
      const src = safeHref(props.src);
      if (!src) return <div className={className} style={{ background: "#e8ece9", minHeight: 160 }} aria-hidden />;
      // Author-supplied remote images stay outside next/image to avoid a per-tenant
      // remotePatterns allowlist; sizing is controlled by the style panel.
      // eslint-disable-next-line @next/next/no-img-element
      return <img className={className} src={src} alt={text(props.alt)} loading="lazy" />;
    },
  },
  Embed: {
    label: "Embed", category: "Media", icon: SquareStack, acceptsChildren: false,
    fields: [{ key: "src", label: "Embed URL", type: "url", placeholder: "https://www.youtube.com/embed/..." }],
    render: ({ props, className }) => {
      const src = safeHref(props.src);
      // Only a framed URL is accepted — never raw HTML — so an embed cannot run script
      // in the site's own origin.
      if (!src) return <div className={className} style={{ background: "#e8ece9", minHeight: 200 }} aria-hidden />;
      return <iframe className={className} src={src} loading="lazy" allowFullScreen title={text(props.title, "Embedded content")} style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }} />;
    },
  },

  Form: {
    label: "Form", category: "Forms", icon: Send, acceptsChildren: true,
    defaultProps: { action: "", submitLabel: "Submit" },
    fields: [
      { key: "action", label: "Post to URL", type: "url", placeholder: "https://..." },
      { key: "submitLabel", label: "Submit button", type: "text" },
    ],
    render: ({ props, children, className }) => (
      <form className={className} action={safeHref(props.action)} method="post">
        {children}
        <button type="submit">{text(props.submitLabel, "Submit")}</button>
      </form>
    ),
  },
  Input: {
    label: "Input", category: "Forms", icon: Baseline, acceptsChildren: false,
    defaultProps: { name: "email", label: "Email", inputType: "email", required: true },
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "name", label: "Field name", type: "text" },
      { key: "inputType", label: "Type", type: "select", options: [
        { value: "text", label: "Text" }, { value: "email", label: "Email" },
        { value: "tel", label: "Phone" }, { value: "textarea", label: "Paragraph" },
      ] },
      { key: "required", label: "Required", type: "boolean" },
    ],
    render: ({ props, className }) => {
      const name = text(props.name, "field");
      const label = text(props.label, "Field");
      const required = props.required === true || props.required === "true";
      return (
        <label className={className}>
          <span>{label}</span>
          {props.inputType === "textarea"
            ? <textarea name={name} required={required} />
            : <input name={name} type={text(props.inputType, "text")} required={required} />}
        </label>
      );
    },
  },

  // Commune blocks are rendered by the renderer itself because they need tenant data.
  // The entries below only carry their palette metadata and editable fields.
  EventList: {
    label: "Upcoming events", category: "Commune", icon: CalendarDays, acceptsChildren: false,
    defaultProps: { limit: 3, heading: "Upcoming events" },
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "limit", label: "How many", type: "number" },
    ],
    render: ({ className }) => <div className={className} />,
  },
  CourseList: {
    label: "Courses", category: "Commune", icon: GraduationCap, acceptsChildren: false,
    defaultProps: { limit: 3, heading: "Courses" },
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "limit", label: "How many", type: "number" },
    ],
    render: ({ className }) => <div className={className} />,
  },
  CollectionList: {
    label: "Collection list", category: "Commune", icon: List, acceptsChildren: true,
    defaultProps: { limit: 6 },
    fields: [
      { key: "collectionId", label: "Collection", type: "collection" },
      { key: "limit", label: "How many", type: "number" },
    ],
    render: ({ children, className }) => <div className={className}>{children}</div>,
  },
  CollectionField: {
    label: "Collection field", category: "Commune", icon: Baseline, acceptsChildren: false,
    defaultProps: { field: "title" },
    // "Render as image" is a per-placement choice rather than inferred from the
    // collection's declared field type, so one field (e.g. a photo URL) can be shown as
    // text in one layout and as an image in another without changing the collection.
    fields: [
      { key: "field", label: "Field key", type: "text", placeholder: "title" },
      { key: "asImage", label: "Render as image", type: "boolean" },
    ],
    // The renderer (which has the entry data) fills this in; asImage decides img vs span there.
    render: ({ className }) => <span className={className} />,
  },
  PricingTable: {
    label: "Pricing", category: "Commune", icon: CreditCard, acceptsChildren: false,
    defaultProps: { heading: "Membership", plans: "Monthly|$29|Everything you need\nAnnual|$290|Two months free" },
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "plans", label: "Plans (name|price|detail per line)", type: "textarea" },
    ],
    render: ({ className }) => <div className={className} />,
  },
  MemberSignup: {
    label: "Signup call to action", category: "Commune", icon: UserRoundPlus, acceptsChildren: false,
    defaultProps: { heading: "Join the community", buttonLabel: "Create your account" },
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "buttonLabel", label: "Button label", type: "text" },
    ],
    render: ({ className }) => <div className={className} />,
  },
};

/** Blocks the renderer handles itself because they read tenant data. */
export const DATA_COMPONENTS = new Set(["EventList", "CourseList", "CollectionList", "CollectionField", "PricingTable", "MemberSignup"]);

export const PALETTE_CATEGORIES = ["Layout", "Content", "Media", "Forms", "Commune"] as const;

export function componentMeta(component: string): ComponentMeta | undefined {
  return WEBSITE_COMPONENTS[component];
}
