"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronRight } from "lucide-react";
import { componentMeta } from "@/lib/website/components";
import { findInstance, instanceText } from "@/lib/website/mutations";
import type { WebsiteDocument } from "@/lib/website/schema";
import { cn } from "@/lib/utils";

export function layerDropId(instanceId: string) {
  return `into|${instanceId}`;
}

function LayerRow({ document, instanceId, depth, selectedId, onSelect, dragActive }: {
  document: WebsiteDocument;
  instanceId: string;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  dragActive: boolean;
}) {
  const instance = findInstance(document, instanceId);
  const meta = instance ? componentMeta(instance.component) : undefined;
  const { setNodeRef: dragRef, listeners, attributes, isDragging } = useDraggable({ id: `move|${instanceId}` });
  // Only containers accept a drop, and only while something is being dragged.
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: layerDropId(instanceId),
    disabled: !dragActive || !meta?.acceptsChildren,
  });

  if (!instance || !meta) return null;
  const childIds = instance.children.filter((child) => child.type === "id").map((child) => child.value);
  const label = meta.editableText ? instanceText(document, instanceId).slice(0, 28) || meta.label : meta.label;
  const Icon = meta.icon;

  return (
    <div>
      <div ref={dropRef}>
        <button
          ref={dragRef}
          {...attributes}
          {...listeners}
          type="button"
          onClick={() => onSelect(instanceId)}
          style={{ paddingLeft: 8 + depth * 12 }}
          className={cn(
            "flex w-full cursor-grab items-center gap-2 rounded-lg py-1.5 pr-2 text-left transition",
            selectedId === instanceId ? "bg-[#e6f2eb] text-[#225f45]" : "hover:bg-[#f2f6f4] text-[#4c5a52]",
            isOver && "ring-1 ring-[#2e7b5c]",
            isDragging && "opacity-40",
          )}
        >
          {childIds.length > 0
            ? <ChevronRight size={12} className="shrink-0 rotate-90 text-[#9aa59e]" />
            : <span className="w-3 shrink-0" />}
          <Icon size={13} className="shrink-0 text-[#6b7d73]" />
          <span className="truncate text-[11px] font-semibold">{label}</span>
        </button>
      </div>
      {childIds.map((childId) => (
        <LayerRow key={childId} document={document} instanceId={childId} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} dragActive={dragActive} />
      ))}
    </div>
  );
}

export function LayerTree({ document, selectedId, onSelect, dragActive }: {
  document: WebsiteDocument;
  selectedId: string | null;
  onSelect: (id: string) => void;
  dragActive: boolean;
}) {
  if (!document.roots.length) {
    return <p className="px-2 text-[11px] text-[#8c988f]">No layers yet.</p>;
  }
  return (
    <div className="space-y-0.5">
      {document.roots.map((rootId) => (
        <LayerRow key={rootId} document={document} instanceId={rootId} depth={0} selectedId={selectedId} onSelect={onSelect} dragActive={dragActive} />
      ))}
    </div>
  );
}
