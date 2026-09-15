"use client";

import { useDraggable } from "@dnd-kit/core";
import { PALETTE_CATEGORIES, WEBSITE_COMPONENTS } from "@/lib/website/components";
import { cn } from "@/lib/utils";

function PaletteItem({ component }: { component: string }) {
  const meta = WEBSITE_COMPONENTS[component];
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `new|${component}` });
  const Icon = meta.icon;
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      className={cn(
        "flex w-full cursor-grab items-center gap-2.5 rounded-xl border border-[#e3e9e5] bg-white px-2.5 py-2 text-left transition hover:border-[#a9c8b8]",
        isDragging && "opacity-40",
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#eef5f1] text-[#2a7657]"><Icon size={14} /></span>
      <span className="truncate text-[11px] font-semibold text-[#3c4a42]">{meta.label}</span>
    </button>
  );
}

export function Palette() {
  return (
    <div className="space-y-5">
      {PALETTE_CATEGORIES.map((category) => {
        const components = Object.entries(WEBSITE_COMPONENTS).filter(([, meta]) => meta.category === category);
        if (!components.length) return null;
        return (
          <div key={category}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#7d8a82]">{category}</p>
            <div className="grid gap-1.5">
              {components.map(([component]) => <PaletteItem key={component} component={component} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
