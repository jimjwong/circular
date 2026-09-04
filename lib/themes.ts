export const THEME_FONT_OPTIONS = [
  { id: "inter", label: "Inter", stack: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" },
  { id: "manrope", label: "Manrope", stack: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif" },
  { id: "system", label: "System Sans", stack: "ui-sans-serif, system-ui, -apple-system, sans-serif" },
  { id: "editorial", label: "Editorial Serif", stack: "Georgia, Cambria, 'Times New Roman', serif" },
] as const;

export type ThemeFontId = (typeof THEME_FONT_OPTIONS)[number]["id"];

export type ThemeConfig = {
  primary: string;
  primaryHover: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  headingFont: ThemeFontId;
  bodyFont: ThemeFontId;
};

export type ThemePresetId = "forest" | "ocean" | "sunset" | "violet" | "rose" | "slate" | "apss" | "custom";

export const THEME_PRESETS: Record<Exclude<ThemePresetId, "custom">, { name: string; description: string; config: ThemeConfig }> = {
  forest: {
    name: "Forest",
    description: "Grounded, calm, and community-led",
    config: { primary: "#183f30", primaryHover: "#245841", accent: "#f3b661", background: "#f6f8f6", surface: "#ffffff", text: "#18251f", muted: "#718078", border: "#dce5df", headingFont: "manrope", bodyFont: "inter" },
  },
  ocean: {
    name: "Ocean",
    description: "Clear, confident, and professional",
    config: { primary: "#164e63", primaryHover: "#0e7490", accent: "#38bdf8", background: "#f0f9ff", surface: "#ffffff", text: "#12303b", muted: "#607b86", border: "#cfe6ef", headingFont: "manrope", bodyFont: "inter" },
  },
  sunset: {
    name: "Sunset",
    description: "Warm, energetic, and welcoming",
    config: { primary: "#9a3412", primaryHover: "#c2410c", accent: "#f59e0b", background: "#fff7ed", surface: "#ffffff", text: "#431407", muted: "#866b61", border: "#f1d5c6", headingFont: "manrope", bodyFont: "inter" },
  },
  violet: {
    name: "Violet",
    description: "Creative, polished, and expressive",
    config: { primary: "#5b21b6", primaryHover: "#6d28d9", accent: "#c084fc", background: "#faf5ff", surface: "#ffffff", text: "#2e1065", muted: "#756888", border: "#e4d5f3", headingFont: "manrope", bodyFont: "inter" },
  },
  rose: {
    name: "Rose",
    description: "Human, vibrant, and optimistic",
    config: { primary: "#9f1239", primaryHover: "#be123c", accent: "#fb7185", background: "#fff1f2", surface: "#ffffff", text: "#4c0519", muted: "#886874", border: "#f2d0d8", headingFont: "manrope", bodyFont: "inter" },
  },
  slate: {
    name: "Slate",
    description: "Minimal, focused, and modern",
    config: { primary: "#1e293b", primaryHover: "#334155", accent: "#22c55e", background: "#f1f5f9", surface: "#ffffff", text: "#0f172a", muted: "#64748b", border: "#d8e0e9", headingFont: "system", bodyFont: "system" },
  },
  apss: {
    name: "APSS",
    description: "Bold orange and blue-teal, inspired by APSS",
    config: { primary: "#ef5222", primaryHover: "#d94719", accent: "#31687d", background: "#f0f0f0", surface: "#ffffff", text: "#202020", muted: "#707070", border: "#d8d8d8", headingFont: "manrope", bodyFont: "inter" },
  },
};

export const DEFAULT_THEME = THEME_PRESETS.forest.config;

export function isThemePreset(value: unknown): value is ThemePresetId {
  return typeof value === "string" && [...Object.keys(THEME_PRESETS), "custom"].includes(value);
}

export function resolveTheme(preset: unknown, overrides: unknown): ThemeConfig {
  const presetId = isThemePreset(preset) ? preset : "forest";
  const base = presetId === "custom" ? DEFAULT_THEME : THEME_PRESETS[presetId].config;
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return base;
  const candidate = overrides as Partial<ThemeConfig>;
  const hex = /^#[0-9a-f]{6}$/i;
  const fontIds = new Set(THEME_FONT_OPTIONS.map((font) => font.id));
  return {
    primary: hex.test(candidate.primary ?? "") ? candidate.primary! : base.primary,
    primaryHover: hex.test(candidate.primaryHover ?? "") ? candidate.primaryHover! : base.primaryHover,
    accent: hex.test(candidate.accent ?? "") ? candidate.accent! : base.accent,
    background: hex.test(candidate.background ?? "") ? candidate.background! : base.background,
    surface: hex.test(candidate.surface ?? "") ? candidate.surface! : base.surface,
    text: hex.test(candidate.text ?? "") ? candidate.text! : base.text,
    muted: hex.test(candidate.muted ?? "") ? candidate.muted! : base.muted,
    border: hex.test(candidate.border ?? "") ? candidate.border! : base.border,
    headingFont: fontIds.has(candidate.headingFont as ThemeFontId) ? candidate.headingFont! : base.headingFont,
    bodyFont: fontIds.has(candidate.bodyFont as ThemeFontId) ? candidate.bodyFont! : base.bodyFont,
  };
}

export function themeCssVariables(theme: ThemeConfig) {
  const font = (id: ThemeFontId) => THEME_FONT_OPTIONS.find((option) => option.id === id)?.stack ?? THEME_FONT_OPTIONS[0].stack;
  return {
    "--theme-primary": theme.primary,
    "--theme-primary-hover": theme.primaryHover,
    "--theme-accent": theme.accent,
    "--theme-background": theme.background,
    "--theme-surface": theme.surface,
    "--theme-text": theme.text,
    "--theme-muted": theme.muted,
    "--theme-border": theme.border,
    "--theme-heading-font": font(theme.headingFont),
    "--theme-body-font": font(theme.bodyFont),
  } as Record<string, string>;
}
