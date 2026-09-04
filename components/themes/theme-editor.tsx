"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Palette, RotateCcw, Save, Sparkles, Type } from "lucide-react";
import { updateWorkspaceTheme, type ThemeActionState } from "@/app/actions/themes";
import { DEFAULT_THEME, THEME_FONT_OPTIONS, THEME_PRESETS, themeCssVariables, type ThemeConfig, type ThemePresetId } from "@/lib/themes";
import { cn } from "@/lib/utils";

const colorFields: { key: keyof Pick<ThemeConfig, "primary" | "primaryHover" | "accent" | "background" | "surface" | "text" | "muted" | "border">; label: string }[] = [
  { key: "primary", label: "Primary" }, { key: "primaryHover", label: "Primary hover" },
  { key: "accent", label: "Accent" }, { key: "background", label: "Page background" },
  { key: "surface", label: "Cards & surfaces" }, { key: "text", label: "Main text" },
  { key: "muted", label: "Muted text" }, { key: "border", label: "Borders" },
];

export function ThemeEditor({ initialPreset, initialTheme, canManage }: { initialPreset: string; initialTheme: ThemeConfig; canManage: boolean }) {
  const [preset, setPreset] = useState<ThemePresetId>((initialPreset as ThemePresetId) || "forest");
  const [theme, setTheme] = useState(initialTheme);
  const [state, action, pending] = useActionState<ThemeActionState | undefined, FormData>(updateWorkspaceTheme, undefined);
  const variables = useMemo(() => themeCssVariables(theme), [theme]);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".theme-shell");
    if (!shell) return;
    const prior = Object.fromEntries(Object.keys(variables).map((key) => [key, shell.style.getPropertyValue(key)]));
    Object.entries(variables).forEach(([key, value]) => shell.style.setProperty(key, value));
    return () => Object.entries(prior).forEach(([key, value]) => shell.style.setProperty(key, value));
  }, [variables]);

  function choosePreset(next: Exclude<ThemePresetId, "custom">) {
    setPreset(next);
    setTheme(THEME_PRESETS[next].config);
  }

  function update<K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) {
    setPreset("custom");
    setTheme((current) => ({ ...current, [key]: value }));
  }

  return <>
    {!canManage && <div className="theme-soft theme-brand-text mb-5 flex items-start gap-3 rounded-2xl border border-current/10 p-4"><Palette className="mt-0.5 shrink-0" size={17}/><div><b className="block text-sm">Viewing the workspace theme</b><p className="mt-1 text-xs leading-5 opacity-80">Only workspace owners and admins can change these settings. You can still view the active palette and typography below.</p></div></div>}
    <form action={action} data-readonly={!canManage || undefined} className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]", !canManage && "pointer-events-none select-none opacity-75")}>
    <input type="hidden" name="preset" value={preset}/>
    {Object.entries(theme).map(([key, value]) => <input key={key} type="hidden" name={key} value={value}/>) }
    <div className="space-y-6">
      <section className="theme-card rounded-[22px] border p-5 sm:p-6"><div className="flex items-center gap-3"><span className="theme-soft theme-brand-text grid size-10 place-items-center rounded-xl"><Palette size={18}/></span><div><h2 className="font-display font-bold">Curated palettes</h2><p className="theme-muted text-xs">Select a complete visual direction in one click.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(THEME_PRESETS).map(([id, option]) => { const selected = preset === id; return <button key={id} type="button" onClick={() => choosePreset(id as Exclude<ThemePresetId, "custom">)} aria-pressed={selected} className={cn("relative rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md", selected ? "theme-selected-ring" : "theme-border")}><div className="flex gap-1.5">{[option.config.primary, option.config.accent, option.config.background, option.config.text].map((color) => <span key={color} className="size-7 rounded-full border border-black/5" style={{ backgroundColor: color }}/>)}</div><b className="mt-4 block text-sm">{option.name}</b><span className="theme-muted mt-1 block text-[11px] leading-4">{option.description}</span>{selected && <span className="theme-primary absolute right-3 top-3 grid size-5 place-items-center rounded-full text-white"><Check size={12}/></span>}</button>; })}<button type="button" onClick={() => setPreset("custom")} aria-pressed={preset === "custom"} className={cn("relative rounded-2xl border border-dashed p-4 text-left transition", preset === "custom" ? "theme-selected-ring" : "theme-border")}><span className="theme-soft theme-brand-text grid size-7 place-items-center rounded-full"><Sparkles size={14}/></span><b className="mt-4 block text-sm">Custom</b><span className="theme-muted mt-1 block text-[11px] leading-4">Fine-tune every color and font.</span>{preset === "custom" && <span className="theme-primary absolute right-3 top-3 grid size-5 place-items-center rounded-full text-white"><Check size={12}/></span>}</button></div></section>
      <section className="theme-card rounded-[22px] border p-5 sm:p-6"><h2 className="font-display font-bold">Custom colors</h2><p className="theme-muted mt-1 text-xs">Changing any value automatically creates a custom theme.</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{colorFields.map((field) => <label key={field.key} className="block"><span className="mb-2 block text-xs font-semibold">{field.label}</span><span className="theme-field flex h-11 items-center gap-3 rounded-xl border px-2"><input aria-label={`${field.label} color picker`} type="color" value={theme[field.key]} onChange={(event) => update(field.key, event.target.value)} className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"/><input aria-label={`${field.label} hex value`} value={theme[field.key]} onChange={(event) => /^#[0-9a-f]{0,6}$/i.test(event.target.value) && update(field.key, event.target.value as string)} className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase outline-none" maxLength={7}/></span>{state?.errors?.[field.key]?.[0] && <small className="mt-1 block text-red-700">{state.errors[field.key][0]}</small>}</label>)}</div></section>
      <section className="theme-card rounded-[22px] border p-5 sm:p-6"><div className="flex items-center gap-3"><Type size={18} className="theme-brand-text"/><h2 className="font-display font-bold">Typography</h2></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><FontSelect label="Heading font" value={theme.headingFont} onChange={(value) => update("headingFont", value)}/><FontSelect label="Body font" value={theme.bodyFont} onChange={(value) => update("bodyFont", value)}/></div></section>
      {(state?.message || state?.success) && <p role="status" className={cn("rounded-xl px-4 py-3 text-xs font-semibold", state.success ? "theme-soft theme-brand-text" : "bg-red-50 text-red-800")}>{state.success || state.message}</p>}
      <div className="flex flex-wrap justify-end gap-3"><button type="button" onClick={() => { setPreset("forest"); setTheme(DEFAULT_THEME); }} className="theme-secondary-button inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-xs font-bold"><RotateCcw size={14}/> Reset to Forest</button><button disabled={pending} className="theme-primary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-xs font-bold text-white disabled:opacity-60">{pending ? <LoaderCircle size={15} className="animate-spin"/> : <Save size={15}/>} {pending ? "Saving…" : "Save workspace theme"}</button></div>
    </div>
    <aside className="xl:sticky xl:top-6 xl:h-fit"><div className="theme-card overflow-hidden rounded-[24px] border shadow-lg"><div className="theme-primary p-6 text-white"><span className="text-[10px] font-bold uppercase tracking-[.18em] opacity-70">Live preview</span><h2 className="font-display mt-4 text-2xl font-bold">Bring your people together.</h2><p className="mt-2 text-sm leading-6 opacity-75">A space that looks and feels unmistakably yours.</p><button type="button" className="mt-5 rounded-xl px-4 py-2.5 text-xs font-bold" style={{ backgroundColor: theme.accent, color: theme.text }}>Join the conversation</button></div><div className="p-5"><div className="flex items-center gap-3"><span className="theme-soft theme-brand-text grid size-10 place-items-center rounded-full text-xs font-bold">AC</span><div><b className="block text-sm">Aisha Chen</b><span className="theme-muted text-[11px]">Posted in Introductions</span></div></div><h3 className="font-display mt-5 font-bold">What are you building this month?</h3><p className="theme-muted mt-2 text-xs leading-5">Share one goal with the community and meet someone working toward something similar.</p><div className="theme-divider mt-5 flex gap-4 border-t pt-4 text-xs"><span className="theme-brand-text font-semibold">♥ 24</span><span className="theme-muted">12 comments</span></div></div></div><p className="theme-muted mt-3 text-center text-[11px]">Changes preview across this page before you save.</p></aside>
    </form>
  </>;
}

function FontSelect({ label, value, onChange }: { label: string; value: ThemeConfig["headingFont"]; onChange: (value: ThemeConfig["headingFont"]) => void }) {
  return <label><span className="mb-2 block text-xs font-semibold">{label}</span><select value={value} onChange={(event) => onChange(event.target.value as ThemeConfig["headingFont"])} className="theme-field h-11 w-full rounded-xl border bg-transparent px-3 text-xs outline-none">{THEME_FONT_OPTIONS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select><span className="theme-muted mt-2 block text-lg" style={{ fontFamily: THEME_FONT_OPTIONS.find((font) => font.id === value)?.stack }}>Circular Community</span></label>;
}
