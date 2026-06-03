import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeColorKey = "default" | "azul" | "verde" | "roxo" | "vermelho" | "laranja" | "rosa";

type Palette = { primary: string; ring: string; chart1: string; swatch: string };

export const THEME_COLORS: Record<Exclude<ThemeColorKey, "default">, Palette & { label: string }> = {
  azul:     { label: "Azul",     primary: "oklch(0.55 0.18 255)", ring: "oklch(0.55 0.18 255)", chart1: "oklch(0.55 0.18 255)", swatch: "#2563EB" },
  verde:    { label: "Verde",    primary: "oklch(0.62 0.18 150)", ring: "oklch(0.62 0.18 150)", chart1: "oklch(0.62 0.18 150)", swatch: "#16A34A" },
  roxo:     { label: "Roxo",     primary: "oklch(0.52 0.22 300)", ring: "oklch(0.52 0.22 300)", chart1: "oklch(0.52 0.22 300)", swatch: "#7C3AED" },
  vermelho: { label: "Vermelho", primary: "oklch(0.58 0.22 25)",  ring: "oklch(0.58 0.22 25)",  chart1: "oklch(0.58 0.22 25)",  swatch: "#DC2626" },
  laranja:  { label: "Laranja",  primary: "oklch(0.68 0.18 55)",  ring: "oklch(0.68 0.18 55)",  chart1: "oklch(0.68 0.18 55)",  swatch: "#EA580C" },
  rosa:     { label: "Rosa",     primary: "oklch(0.65 0.22 350)", ring: "oklch(0.65 0.22 350)", chart1: "oklch(0.65 0.22 350)", swatch: "#EC4899" },
};

const STORAGE_KEY = "app:theme-color";

function applyTheme(key: ThemeColorKey) {
  const root = document.documentElement;
  if (key === "default") {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--chart-1");
    return;
  }
  const p = THEME_COLORS[key];
  root.style.setProperty("--primary", p.primary);
  root.style.setProperty("--ring", p.ring);
  root.style.setProperty("--chart-1", p.chart1);
}

const Ctx = createContext<{ color: ThemeColorKey; setColor: (c: ThemeColorKey) => void }>({
  color: "default",
  setColor: () => {},
});

export function ThemeColorProvider({ children }: { children: ReactNode }) {
  const [color, setColorState] = useState<ThemeColorKey>("default");

  useEffect(() => {
    try {
      const saved = (localStorage.getItem(STORAGE_KEY) as ThemeColorKey | null) ?? "default";
      setColorState(saved);
      applyTheme(saved);
    } catch {}
  }, []);

  const setColor = (c: ThemeColorKey) => {
    setColorState(c);
    applyTheme(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch {}
  };

  return <Ctx.Provider value={{ color, setColor }}>{children}</Ctx.Provider>;
}

export const useThemeColor = () => useContext(Ctx);
