"use client";

import { cloneElement, isValidElement, type ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { componentMeta, DATA_COMPONENTS } from "@/lib/website/components";
import { instanceClassNames, renderDocumentCss } from "@/lib/website/css";
import { CANVAS_CHROME, SITE_RESET } from "@/lib/website/site-css";
import { findInstance, instanceProps, instanceText } from "@/lib/website/mutations";
import type { WebsiteDocument } from "@/lib/website/schema";
import { cn } from "@/lib/utils";

export const ROOT_PARENT = "root";

export function slotId(parentId: string | null, index: number) {
  return `slot|${parentId ?? ROOT_PARENT}|${index}`;
}

export function parseSlotId(id: string) {
  const [, parent, index] = id.split("|");
  return { parentId: parent === ROOT_PARENT ? null : parent, index: Number(index) };
}

/** A thin drop target between two siblings. Only interactive while a drag is running. */
function DropSlot({ parentId, index, active }: { parentId: string | null; index: number; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(parentId, index), disabled: !active });
  if (!active) return null;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "ws-drop-slot",
        isOver ? "bg-[#2e7b5c]" : "bg-[#b9d8c8]",
      )}
      style={{ height: isOver ? 10 : 6, borderRadius: 999, margin: "4px 0", transition: "height .12s ease" }}
    />
  );
}

/** Commune blocks read tenant data at publish time, so the canvas shows a labelled stand-in. */
function DataBlockPreview({ component, label }: { component: string; label: string }) {
  return (
    <div style={{ border: "1px dashed #9fb8ab", borderRadius: 14, padding: "18px 16px", background: "#f3f8f5", textAlign: "center" }}>
      <strong style={{ display: "block", fontSize: 13, color: "#2a6d51" }}>{label}</strong>
      <span style={{ fontSize: 11, color: "#77867d" }}>{component} · live data appears on the published page</span>
    </div>
  );
}

function CanvasNode({ document, instanceId, selectedId, onSelect, dragActive }: {
  document: WebsiteDocument;
  instanceId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  dragActive: boolean;
}) {
  const instance = findInstance(document, instanceId);
  const meta = instance ? componentMeta(instance.component) : undefined;
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `move|${instanceId}` });

  if (!instance || !meta) return null;

  const selected = selectedId === instanceId;
  const props = instanceProps(document, instanceId);
  const className = cn(instanceClassNames(document, instanceId), "ws-node", selected && "ws-node-selected", isDragging && "ws-node-dragging");

  let children: ReactNode = null;
  if (DATA_COMPONENTS.has(instance.component) && instance.component !== "CollectionList") {
    children = null;
  } else if (meta.editableText) {
    // Text components hand their string straight through, matching the server renderer.
    children = instanceText(document, instanceId);
  } else if (meta.acceptsChildren) {
    const nodes: ReactNode[] = [<DropSlot key="slot-0" parentId={instanceId} index={0} active={dragActive} />];
    instance.children.forEach((child, index) => {
      if (child.type !== "id") return;
      nodes.push(
        <CanvasNode key={child.value} document={document} instanceId={child.value} selectedId={selectedId} onSelect={onSelect} dragActive={dragActive} />,
        <DropSlot key={`slot-${index + 1}`} parentId={instanceId} index={index + 1} active={dragActive} />,
      );
    });
    children = nodes;
  }

  const element = DATA_COMPONENTS.has(instance.component) && instance.component !== "CollectionList"
    ? <div className={className}><DataBlockPreview component={instance.component} label={String(props.heading ?? meta.label)} /></div>
    : meta.render({ props, children, className });

  if (!isValidElement(element)) return <>{element}</>;

  return cloneElement(element as React.ReactElement<Record<string, unknown>>, {
    ref: setNodeRef,
    ...attributes,
    ...listeners,
    "data-ws-id": instanceId,
    onClick: (event: React.MouseEvent) => {
      // Stop the click at the innermost node so selecting a child never selects its parent.
      event.preventDefault();
      event.stopPropagation();
      onSelect(instanceId);
    },
  });
}

export function Canvas({ document, selectedId, onSelect, dragActive, width }: {
  document: WebsiteDocument;
  selectedId: string | null;
  onSelect: (id: string) => void;
  dragActive: boolean;
  width: number | null;
}) {
  const empty = document.roots.length === 0;
  return (
    <div className="mx-auto h-full w-full overflow-auto bg-[#eef2f0] p-4 sm:p-8">
      <div
        className="ws-site mx-auto min-h-full bg-white shadow-[0_10px_40px_rgba(24,63,48,.08)] transition-[max-width]"
        style={{ maxWidth: width ? `${width}px` : "100%" }}
      >
        {/* The page's own stylesheet first, then the editing affordances on top of it. */}
        <style dangerouslySetInnerHTML={{ __html: SITE_RESET + renderDocumentCss(document) + CANVAS_CHROME }} />
        <DropSlot parentId={null} index={0} active={dragActive} />
        {empty && !dragActive && (
          <p className="p-16 text-center text-sm text-[#77867d]">
            Drag a component from the left panel to start this page.
          </p>
        )}
        {document.roots.map((rootId, index) => (
          <div key={rootId}>
            <CanvasNode document={document} instanceId={rootId} selectedId={selectedId} onSelect={onSelect} dragActive={dragActive} />
            <DropSlot parentId={null} index={index + 1} active={dragActive} />
          </div>
        ))}
      </div>
    </div>
  );
}
