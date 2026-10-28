import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Mode = "light" | "dark";
const KEY = "cgb.theme";

const LIGHT = {
  text: "#6c6672",
  grid: "#eeebf0",
  cursor: "#f5f4f6",
  onBar: "#ffffff",
  lesao: { "COM AFASTAMENTO": "#6b1a28", FATAL: "#17141a", INCIDENTE: "#8b979b", "SEM AFASTAMENTO": "#e06c75" } as Record<string, string>,
  paleta: ["#8c1c3d", "#d9485f", "#e8a0a8", "#5f6b73", "#b79aae", "#2d2830", "#c98a3d", "#3d7a8c"],
  anos: ["#f0c4cd", "#e8909f", "#d9485f", "#8c1c3d"],
  bar: "#8c1c3d",
  ok: "#34a853",
  bad: "#d63a4a",
};

const DARK: typeof LIGHT = {
  text: "#a39aa9",
  grid: "#2c2830",
  cursor: "#26222a",
  onBar: "#ffffff",
  lesao: { "COM AFASTAMENTO": "#b3354f", FATAL: "#e9e4ec", INCIDENTE: "#8fa0a6", "SEM AFASTAMENTO": "#e8707c" },
  paleta: ["#e0566f", "#b3354f", "#f2a7b3", "#8fa0a6", "#c4a3bb", "#e9e4ec", "#d9a05b", "#5fa3b5"],
  anos: ["#6e5a66", "#b0687f", "#e0566f", "#ff8da1"],
  bar: "#e0566f",
  ok: "#4cc26b",
  bad: "#f0586a",
};

interface Ctx {
  mode: Mode;
  toggle: () => void;
  c: typeof LIGHT;
}

const ThemeCtx = createContext<Ctx>(null!);
export const useTheme = () => useContext(ThemeCtx);

function inicial(): Mode {
  try {
    const s = localStorage.getItem(KEY);
    if (s === "light" || s === "dark") return s;
  } catch {
    /* ignora */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(inicial);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "dark" ? "#100e12" : "#8c1c3d");
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* ignora */
    }
  }, [mode]);

  const toggle = useCallback(() => setMode((m) => (m === "dark" ? "light" : "dark")), []);
  const value = useMemo(() => ({ mode, toggle, c: mode === "dark" ? DARK : LIGHT }), [mode, toggle]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
