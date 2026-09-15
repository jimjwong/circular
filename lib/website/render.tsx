import type { ReactNode } from "react";
import { componentMeta, DATA_COMPONENTS, safeHref, type RenderedProps } from "@/lib/website/components";
import { instanceClassNames } from "@/lib/website/css";
import { matchPagePath, type SitePageRoute } from "@/lib/website/routing";
import type { Instance, WebsiteDocument } from "@/lib/website/schema";

export type CollectionEntry = {
  id: string;
  slug: string;
  title: string;
  data: Record<string, unknown>;
};

export type WebsiteRenderData = {
  events: { id: string; title: string; description: string | null; starts_at: string; location_url: string | null }[];
  courses: { id: string; title: string; description: string | null }[];
  /** Published entries keyed by collection id, for CollectionList blocks. */
  entries: Record<string, CollectionEntry[]>;
  signupHref: string;
  /** Prefix the site is served under, e.g. "/collective" for a directory mount, "" for a host. */
  basePath: string;
  /** The site's published routes, used to tell internal links from links to the application. */
  pageRoutes: SitePageRoute[];
};

export const EMPTY_RENDER_DATA: WebsiteRenderData = {
  events: [], courses: [], entries: {}, signupHref: "/signup", basePath: "", pageRoutes: [],
};

/**
 * Rewrites a root-relative link that points at one of this site's own pages so it stays
 * inside the site. Authors write "/contact"; served from a directory mount that has to
 * become "/collective/contact". Anything that is not a site route — "/signup", an
 * external URL, an anchor — is left exactly as written.
 */
function resolveSiteHref(href: string, data: WebsiteRenderData) {
  if (!href.startsWith("/") || !data.pageRoutes.length) return href;
  if (!matchPagePath(data.pageRoutes, href)) return href;
  if (!data.basePath) return href;
  return href === "/" ? data.basePath : `${data.basePath}${href}`;
}

type RenderContext = {
  document: WebsiteDocument;
  data: WebsiteRenderData;
  /** Set while rendering inside a CollectionList item or a collection template page. */
  entry?: CollectionEntry;
};

function instanceProps(document: WebsiteDocument, instance: Instance): RenderedProps {
  const meta = componentMeta(instance.component);
  const resolved: RenderedProps = { ...(meta?.defaultProps ?? {}) };
  for (const prop of document.props) {
    if (prop.instanceId === instance.id) resolved[prop.name] = prop.value;
  }
  return resolved;
}

function formatEventDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function entryValue(entry: CollectionEntry | undefined, field: string) {
  if (!entry) return "";
  if (field === "title") return entry.title;
  if (field === "slug") return entry.slug;
  const value = entry.data[field];
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** Renders the Commune-native blocks, which need tenant data rather than just props. */
function renderDataComponent(instance: Instance, props: RenderedProps, className: string, context: RenderContext): ReactNode {
  const { data } = context;
  const limit = Math.min(Math.max(Number(props.limit) || 3, 1), 24);
  const heading = typeof props.heading === "string" ? props.heading : "";

  switch (instance.component) {
    case "EventList": {
      const events = data.events.slice(0, limit);
      return (
        <div className={className}>
          {heading && <h2 className="ws-block-heading">{heading}</h2>}
          {events.length === 0
            ? <p className="ws-block-empty">No upcoming events yet.</p>
            : <ul className="ws-block-list">{events.map((event) => (
                <li key={event.id} className="ws-block-item">
                  <span className="ws-block-meta">{formatEventDate(event.starts_at)}</span>
                  <strong className="ws-block-title">{event.title}</strong>
                  {event.location_url && <span className="ws-block-meta">{event.location_url}</span>}
                  {event.description && <p className="ws-block-body">{event.description}</p>}
                </li>
              ))}</ul>}
        </div>
      );
    }
    case "CourseList": {
      const courses = data.courses.slice(0, limit);
      return (
        <div className={className}>
          {heading && <h2 className="ws-block-heading">{heading}</h2>}
          {courses.length === 0
            ? <p className="ws-block-empty">No published courses yet.</p>
            : <ul className="ws-block-list">{courses.map((course) => (
                <li key={course.id} className="ws-block-item">
                  <strong className="ws-block-title">{course.title}</strong>
                  {course.description && <p className="ws-block-body">{course.description}</p>}
                </li>
              ))}</ul>}
        </div>
      );
    }
    case "CollectionList": {
      const collectionId = typeof props.collectionId === "string" ? props.collectionId : "";
      const entries = (data.entries[collectionId] ?? []).slice(0, limit);
      if (!entries.length) return <div className={className}><p className="ws-block-empty">No entries published yet.</p></div>;
      return (
        <div className={className}>
          {entries.map((entry) => (
            <div key={entry.id} className="ws-collection-item">
              {renderChildren(instance, { ...context, entry })}
            </div>
          ))}
        </div>
      );
    }
    case "CollectionField": {
      const value = entryValue(context.entry, String(props.field ?? "title"));
      if (props.asImage === true || props.asImage === "true") {
        const src = safeHref(value);
        if (!src) return <div className={className} style={{ background: "#e8ece9", minHeight: 120 }} aria-hidden />;
        // eslint-disable-next-line @next/next/no-img-element
        return <img className={className} src={src} alt="" loading="lazy" />;
      }
      return <span className={className}>{value}</span>;
    }
    case "PricingTable": {
      const plans = String(props.plans ?? "").split("\n").map((line) => line.split("|")).filter((parts) => parts[0]?.trim());
      return (
        <div className={className}>
          {heading && <h2 className="ws-block-heading">{heading}</h2>}
          <div className="ws-block-list">{plans.map((parts, index) => (
            <div key={index} className="ws-block-item">
              <strong className="ws-block-title">{parts[0]?.trim()}</strong>
              {parts[1] && <span className="ws-block-price">{parts[1].trim()}</span>}
              {parts[2] && <p className="ws-block-body">{parts[2].trim()}</p>}
            </div>
          ))}</div>
        </div>
      );
    }
    case "MemberSignup":
      return (
        <div className={className}>
          {heading && <h2 className="ws-block-heading">{heading}</h2>}
          <a className="ws-block-cta" href={data.signupHref}>{String(props.buttonLabel ?? "Create your account")}</a>
        </div>
      );
    default:
      return null;
  }
}

function renderChildren(instance: Instance, context: RenderContext): ReactNode {
  const nodes: ReactNode[] = [];
  instance.children.forEach((child, index) => {
    if (child.type === "text") {
      nodes.push(child.value);
      return;
    }
    if (child.type === "expression") {
      // Expressions only read the surrounding collection entry; there is no eval here.
      nodes.push(entryValue(context.entry, child.value));
      return;
    }
    const node = renderInstance(child.value, context);
    if (node !== null) nodes.push(<RenderSlot key={`${child.value}-${index}`}>{node}</RenderSlot>);
  });
  if (nodes.length === 1 && typeof nodes[0] === "string") return nodes[0];
  return nodes;
}

function RenderSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function renderInstance(instanceId: string, context: RenderContext): ReactNode {
  const instance = context.document.instances.find((candidate) => candidate.id === instanceId);
  if (!instance) return null;
  const meta = componentMeta(instance.component);
  if (!meta) return null;

  const props = instanceProps(context.document, instance);
  if (typeof props.href === "string") props.href = resolveSiteHref(props.href, context.data);
  const className = instanceClassNames(context.document, instance.id);

  if (DATA_COMPONENTS.has(instance.component)) {
    return renderDataComponent(instance, props, className, context);
  }

  const children = meta.acceptsChildren || meta.editableText ? renderChildren(instance, context) : null;
  return meta.render({ props, children, className });
}

/** Renders every root instance of a page document. */
export function renderDocument(document: WebsiteDocument, data: WebsiteRenderData, entry?: CollectionEntry): ReactNode {
  const context: RenderContext = { document, data, entry };
  return document.roots.map((rootId) => <RenderSlot key={rootId}>{renderInstance(rootId, context)}</RenderSlot>);
}
