"use client";

import { Copy, Trash2 } from "lucide-react";
import { componentMeta, type PropField } from "@/lib/website/components";
import { findInstance, instanceProps, instanceStyle, instanceText } from "@/lib/website/mutations";
import type { WebsiteDocument } from "@/lib/website/schema";
import type { WebsiteCollection } from "@/lib/website/queries";

const STYLE_GROUPS: { label: string; properties: { property: string; label: string; placeholder?: string }[] }[] = [
  { label: "Layout", properties: [
    { property: "display", label: "Display", placeholder: "block" },
    { property: "padding", label: "Padding", placeholder: "24px" },
    { property: "margin", label: "Margin", placeholder: "0 auto" },
    { property: "gap", label: "Gap", placeholder: "16px" },
    { property: "width", label: "Width", placeholder: "100%" },
    { property: "max-width", label: "Max width", placeholder: "1040px" },
    { property: "min-height", label: "Min height", placeholder: "auto" },
  ] },
  { label: "Typography", properties: [
    { property: "font-size", label: "Font size", placeholder: "16px" },
    { property: "font-weight", label: "Weight", placeholder: "400" },
    { property: "line-height", label: "Line height", placeholder: "1.6" },
    { property: "letter-spacing", label: "Tracking", placeholder: "0" },
    { property: "text-align", label: "Align", placeholder: "left" },
    { property: "color", label: "Text colour", placeholder: "#18251f" },
  ] },
  { label: "Decoration", properties: [
    { property: "background-color", label: "Background", placeholder: "#ffffff" },
    { property: "border-radius", label: "Radius", placeholder: "16px" },
    { property: "border", label: "Border", placeholder: "1px solid #e0e7e2" },
    { property: "box-shadow", label: "Shadow", placeholder: "0 8px 20px rgba(0,0,0,.08)" },
  ] },
];

const inputClass = "w-full rounded-lg border border-[#dce5df] bg-white px-2 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-[#b9d8c8]";
const labelClass = "mb-1 block text-[10px] font-semibold text-[#6f7d75]";

export type SitePageOption = { name: string; path: string };

function PropInput({ field, value, collections, pages, onChange }: {
  field: PropField;
  value: string | number | boolean | undefined;
  collections: WebsiteCollection[];
  pages: SitePageOption[];
  onChange: (value: string | number | boolean) => void;
}) {
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-[11px] font-semibold text-[#4c5a52]">
        <input type="checkbox" checked={value === true || value === "true"} onChange={(event) => onChange(event.target.checked)} />
        {field.label}
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <label className="block">
        <span className={labelClass}>{field.label}</span>
        <select className={inputClass} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    );
  }
  if (field.type === "collection") {
    return (
      <label className="block">
        <span className={labelClass}>{field.label}</span>
        <select className={inputClass} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose a collection</option>
          {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
        </select>
      </label>
    );
  }
  if (field.type === "textarea") {
    return (
      <label className="block">
        <span className={labelClass}>{field.label}</span>
        <textarea className={`${inputClass} min-h-20`} value={String(value ?? "")} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }
  // Link fields offer the site's own pages. A page path is stored as written and is
  // rewritten to the site's mount at render time, so it stays correct on every domain.
  const listId = field.type === "url" ? `ws-pages-${field.key}` : undefined;
  return (
    <label className="block">
      <span className={labelClass}>{field.label}</span>
      <input
        className={inputClass}
        type={field.type === "number" ? "number" : "text"}
        list={listId}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(event) => onChange(field.type === "number" ? Number(event.target.value) : event.target.value)}
      />
      {listId && pages.length > 0 && (
        <datalist id={listId}>
          {pages.map((page) => <option key={page.path} value={page.path}>{page.name}</option>)}
        </datalist>
      )}
      {listId && <span className="mt-1 block text-[9px] leading-3 text-[#9aa59e]">Pick a page, or paste a full URL.</span>}
    </label>
  );
}

export function Inspector({ document, selectedId, breakpointId, breakpointLabel, collections, pages, onText, onProp, onStyle, onDuplicate, onDelete }: {
  document: WebsiteDocument;
  selectedId: string | null;
  breakpointId: string;
  breakpointLabel: string;
  collections: WebsiteCollection[];
  pages: SitePageOption[];
  onText: (value: string) => void;
  onProp: (name: string, value: string | number | boolean) => void;
  onStyle: (property: string, value: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const instance = selectedId ? findInstance(document, selectedId) : undefined;
  const meta = instance ? componentMeta(instance.component) : undefined;

  if (!instance || !meta || !selectedId) {
    return <p className="p-4 text-[11px] leading-5 text-[#8c988f]">Select an element on the canvas to edit its content and styles.</p>;
  }

  const props = instanceProps(document, selectedId);

  return (
    <div className="space-y-5 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-[#eef5f1] text-[#2a7657]"><meta.icon size={14} /></span>
          <b className="text-xs">{meta.label}</b>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={onDuplicate} aria-label="Duplicate element" className="grid size-7 place-items-center rounded-lg border border-[#e0e7e2] text-[#66766d] hover:bg-[#f4f7f5]"><Copy size={13} /></button>
          <button type="button" onClick={onDelete} aria-label="Delete element" className="grid size-7 place-items-center rounded-lg border border-[#e0e7e2] text-[#a94f37] hover:bg-[#fff1ed]"><Trash2 size={13} /></button>
        </div>
      </div>

      {meta.editableText && (
        <label className="block">
          <span className={labelClass}>Content</span>
          <textarea className={`${inputClass} min-h-24`} value={instanceText(document, selectedId)} onChange={(event) => onText(event.target.value)} />
        </label>
      )}

      {meta.fields.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#7d8a82]">Settings</p>
          {meta.fields.map((field) => (
            <PropInput key={field.key} field={field} value={props[field.key]} collections={collections} pages={pages} onChange={(value) => onProp(field.key, value)} />
          ))}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#7d8a82]">Styles</p>
          <span className="rounded-full bg-[#eef5f1] px-2 py-0.5 text-[9px] font-bold text-[#2a7657]">{breakpointLabel}</span>
        </div>
        {STYLE_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 text-[10px] font-semibold text-[#8c988f]">{group.label}</p>
            <div className="grid grid-cols-2 gap-2">
              {group.properties.map((entry) => (
                <label key={entry.property} className="block">
                  <span className={labelClass}>{entry.label}</span>
                  <input
                    className={inputClass}
                    value={instanceStyle(document, selectedId, breakpointId, entry.property)}
                    placeholder={entry.placeholder}
                    onChange={(event) => onStyle(entry.property, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <p className="text-[10px] leading-4 text-[#9aa59e]">
          Values apply at {breakpointLabel} and wider. Leave blank to inherit.
        </p>
      </div>
    </div>
  );
}
