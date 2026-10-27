"use client";

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

type ShellContextValue = {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  /** Quick capture lands in phase 1; until then it explains what is coming. */
  capture: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  const togglePalette = useCallback(() => setPaletteOpen((open) => !open), []);

  const capture = useCallback(() => {
    setPaletteOpen(false);
    toast("La capture rapide arrive en phase 1", {
      description: "Note, appel, message, lien ou fichier en moins de 5 secondes, depuis partout.",
    });
  }, []);

  const value = useMemo(
    () => ({ paletteOpen, setPaletteOpen, togglePalette, capture }),
    [paletteOpen, togglePalette, capture],
  );

  return <ShellContext value={value}>{children}</ShellContext>;
}

export function useShell() {
  const context = use(ShellContext);
  if (!context) {
    throw new Error("useShell must be used within a ShellProvider");
  }
  return context;
}
