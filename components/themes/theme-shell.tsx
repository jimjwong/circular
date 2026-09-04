import type { CSSProperties, ReactNode } from "react";
import { resolveTheme, themeCssVariables } from "@/lib/themes";

export function ThemeShell({ preset, config, children }: { preset?: unknown; config?: unknown; children: ReactNode }) {
  const theme = resolveTheme(preset, config);
  return <div className="theme-shell min-h-screen" data-theme={preset || "forest"} style={themeCssVariables(theme) as CSSProperties}>{children}</div>;
}
