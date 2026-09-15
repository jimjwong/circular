"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { ArrowLeft, Check, CloudUpload, ExternalLink, LoaderCircle, Monitor, Smartphone, Tablet, TriangleAlert } from "lucide-react";
import { publishPage, savePageDocument } from "@/app/actions/website";
import { Canvas, parseSlotId } from "@/components/website/builder/canvas";
import { Inspector, type SitePageOption } from "@/components/website/builder/inspector";
import { LayerTree } from "@/components/website/builder/layer-tree";
import { Palette } from "@/components/website/builder/palette";
import { WEBSITE_COMPONENTS } from "@/lib/website/components";
import {
  duplicateInstance, insertComponent, moveInstance, removeInstance,
  setInstanceProp, setInstanceStyle, setInstanceText,
} from "@/lib/website/mutations";
import type { WebsiteCollection } from "@/lib/website/queries";
import type { WebsiteDocument } from "@/lib/website/schema";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

const BREAKPOINT_ICONS: Record<string, typeof Monitor> = { base: Smartphone, tablet: Tablet, desktop: Monitor };
const CANVAS_WIDTHS: Record<string, number | null> = { base: 390, tablet: 820, desktop: null };

export function BuilderShell({ siteId, pageId, pageName, pagePath, previewUrl, initialDocument, collections, pages, isPublished }: {
  siteId: string;
  pageId: string;
  pageName: string;
  pagePath: string;
  previewUrl: string | null;
  initialDocument: WebsiteDocument;
  collections: WebsiteCollection[];
  pages: SitePageOption[];
  isPublished: boolean;
}) {
  const [document, setDocument] = useState<WebsiteDocument>(initialDocument);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [breakpointId, setBreakpointId] = useState("desktop");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState("");
  const [publishing, startPublish] = useTransition();

  // The first render must not trigger a save, otherwise opening a page dirties it.
  const dirty = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const breakpoints = useMemo(
    () => document.breakpoints.slice().sort((a, b) => (a.minWidth ?? 0) - (b.minWidth ?? 0)),
    [document.breakpoints],
  );
  const activeBreakpoint = breakpoints.find((breakpoint) => breakpoint.id === breakpointId) ?? breakpoints[0];

  const update = useCallback((next: WebsiteDocument) => {
    dirty.current = true;
    setDocument(next);
  }, []);

  useEffect(() => {
    if (!dirty.current) return;
    setSaveState("saving");
    const timer = setTimeout(async () => {
      const result = await savePageDocument(siteId, pageId, document);
      setSaveState(result.ok ? "saved" : "error");
      setSaveError(result.ok ? "" : result.message);
    }, 900);
    return () => clearTimeout(timer);
  }, [document, siteId, pageId]);

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // A drop resolves to either a precise slot between siblings, or "append into container".
    let parentId: string | null;
    let index: number;
    if (overId.startsWith("slot|")) {
      ({ parentId, index } = parseSlotId(overId));
    } else if (overId.startsWith("into|")) {
      parentId = overId.slice("into|".length);
      const container = document.instances.find((instance) => instance.id === parentId);
      index = container?.children.length ?? 0;
    } else {
      return;
    }

    if (activeId.startsWith("new|")) {
      const component = activeId.slice("new|".length);
      if (!WEBSITE_COMPONENTS[component]) return;
      const result = insertComponent(document, component, parentId, index);
      update(result.document);
      setSelectedId(result.instanceId);
      return;
    }
    if (activeId.startsWith("move|")) {
      const instanceId = activeId.slice("move|".length);
      if (instanceId === parentId) return;
      update(moveInstance(document, instanceId, parentId, index));
    }
  }

  function handlePublish() {
    startPublish(async () => {
      const result = await publishPage(siteId, pageId);
      setPublishMessage(result.message);
      setTimeout(() => setPublishMessage(""), 3200);
    });
  }

  const draggingLabel = draggingId?.startsWith("new|")
    ? WEBSITE_COMPONENTS[draggingId.slice("new|".length)]?.label
    : "Move element";

  return (
    // A fixed id keeps dnd-kit's generated aria ids deterministic; without it the server
    // and client pick different counter values and hydration mismatches.
    <DndContext id="website-builder" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDraggingId(null)}>
      <div className="flex h-screen flex-col bg-[#f6f8f6]">
        <header className="flex shrink-0 items-center gap-3 border-b border-[#e0e7e2] bg-white px-3 py-2.5">
          <Link href={`/website/${siteId}`} className="grid size-8 place-items-center rounded-lg border border-[#e0e7e2] text-[#5c6d63] hover:bg-[#f4f7f5]" aria-label="Back to site">
            <ArrowLeft size={15} />
          </Link>
          <div className="min-w-0">
            <b className="block truncate text-xs">{pageName}</b>
            <span className="block truncate text-[10px] text-[#83918a]">{pagePath}</span>
          </div>

          <div className="ml-auto flex items-center gap-1 rounded-xl border border-[#e0e7e2] bg-[#f7faf8] p-0.5">
            {breakpoints.map((breakpoint) => {
              const Icon = BREAKPOINT_ICONS[breakpoint.id] ?? Monitor;
              return (
                <button
                  key={breakpoint.id}
                  type="button"
                  onClick={() => setBreakpointId(breakpoint.id)}
                  aria-label={`Edit at ${breakpoint.label}`}
                  aria-pressed={breakpointId === breakpoint.id}
                  className={cn("grid size-7 place-items-center rounded-lg transition", breakpointId === breakpoint.id ? "bg-[#183f30] text-white" : "text-[#66766d] hover:bg-white")}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>

          <span className="hidden items-center gap-1.5 text-[10px] font-semibold text-[#77867d] sm:flex">
            {saveState === "saving" && <><LoaderCircle size={12} className="animate-spin" /> Saving…</>}
            {saveState === "saved" && <><Check size={12} className="text-[#2a7657]" /> Saved</>}
            {saveState === "error" && <span className="flex items-center gap-1 text-[#a94f37]"><TriangleAlert size={12} /> {saveError || "Save failed"}</span>}
          </span>

          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-xl border border-[#e0e7e2] px-3 py-2 text-[11px] font-bold text-[#3c4a42] hover:bg-[#f4f7f5] sm:flex">
              View live <ExternalLink size={12} />
            </a>
          )}
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-1.5 rounded-xl bg-[#183f30] px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-[#245841] disabled:opacity-60"
          >
            {publishing ? <LoaderCircle size={12} className="animate-spin" /> : <CloudUpload size={13} />}
            {isPublished ? "Republish" : "Publish"}
          </button>
        </header>

        {publishMessage && (
          <p role="status" className="shrink-0 bg-[#eaf5ef] px-4 py-2 text-[11px] font-semibold text-[#246b4e]">{publishMessage}</p>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)_260px]">
          <aside className="hidden min-h-0 flex-col border-r border-[#e0e7e2] bg-white lg:flex">
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <Palette />
            </div>
            <div className="max-h-[38%] min-h-0 overflow-auto border-t border-[#e0e7e2] p-2">
              <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#7d8a82]">Layers</p>
              <LayerTree document={document} selectedId={selectedId} onSelect={setSelectedId} dragActive={draggingId !== null} />
            </div>
          </aside>

          <main className="min-h-0 overflow-hidden">
            <Canvas
              document={document}
              selectedId={selectedId}
              onSelect={setSelectedId}
              dragActive={draggingId !== null}
              width={CANVAS_WIDTHS[breakpointId] ?? null}
            />
          </main>

          <aside className="hidden min-h-0 overflow-auto border-l border-[#e0e7e2] bg-white lg:block">
            <Inspector
              document={document}
              selectedId={selectedId}
              breakpointId={breakpointId}
              breakpointLabel={activeBreakpoint?.label ?? "Desktop"}
              collections={collections}
              pages={pages}
              onText={(value) => selectedId && update(setInstanceText(document, selectedId, value))}
              onProp={(name, value) => selectedId && update(setInstanceProp(document, selectedId, name, value))}
              onStyle={(property, value) => selectedId && update(setInstanceStyle(document, selectedId, breakpointId, property, value))}
              onDuplicate={() => {
                if (!selectedId) return;
                const result = duplicateInstance(document, selectedId);
                update(result.document);
                if (result.instanceId) setSelectedId(result.instanceId);
              }}
              onDelete={() => {
                if (!selectedId) return;
                update(removeInstance(document, selectedId));
                setSelectedId(null);
              }}
            />
          </aside>
        </div>

        <p className="shrink-0 border-t border-[#e0e7e2] bg-white px-4 py-2 text-[10px] text-[#8c988f] lg:hidden">
          The page builder needs a wider screen. Open this page on a desktop to edit the layout.
        </p>
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingId && (
          <span className="rounded-lg bg-[#183f30] px-2.5 py-1.5 text-[10px] font-bold text-white shadow-lg">{draggingLabel}</span>
        )}
      </DragOverlay>
    </DndContext>
  );
}
