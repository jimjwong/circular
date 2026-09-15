import { renderDocumentCss } from "@/lib/website/css";
import { renderDocument, type CollectionEntry, type WebsiteRenderData } from "@/lib/website/render";
import { SITE_RESET } from "@/lib/website/site-css";
import type { WebsiteDocument } from "@/lib/website/schema";

export function PublicSite({ document, data, entry }: {
  document: WebsiteDocument;
  data: WebsiteRenderData;
  entry?: CollectionEntry;
}) {
  return (
    <div className="ws-site" style={{ minHeight: "100vh" }}>
      {/* The root layout loads the admin stylesheet, so site pages carry their own reset. */}
      <style dangerouslySetInnerHTML={{ __html: SITE_RESET + renderDocumentCss(document) }} />
      {renderDocument(document, data, entry)}
    </div>
  );
}
