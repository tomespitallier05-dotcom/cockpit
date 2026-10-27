"use client";

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";

export type EditableProject = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  template: "resale" | "content" | "business" | "blank";
  status: "active" | "paused" | "done" | "archived";
};

type ShellContextValue = {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  captureOpen: boolean;
  setCaptureOpen: (open: boolean) => void;
  /** Opens quick capture, optionally pre-filed into a project. */
  capture: (options?: { projectId?: string }) => void;
  captureProjectId: string | null;
  projectDialog: { open: boolean; project: EditableProject | null };
  openProjectDialog: (project?: EditableProject) => void;
  closeProjectDialog: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureProjectId, setCaptureProjectId] = useState<string | null>(null);
  const [projectDialog, setProjectDialog] = useState<{ open: boolean; project: EditableProject | null }>({
    open: false,
    project: null,
  });

  const togglePalette = useCallback(() => setPaletteOpen((open) => !open), []);

  const capture = useCallback((options?: { projectId?: string }) => {
    setPaletteOpen(false);
    setCaptureProjectId(options?.projectId ?? null);
    setCaptureOpen(true);
  }, []);

  const openProjectDialog = useCallback((project?: EditableProject) => {
    setPaletteOpen(false);
    setProjectDialog({ open: true, project: project ?? null });
  }, []);

  const closeProjectDialog = useCallback(() => setProjectDialog((state) => ({ ...state, open: false })), []);

  const value = useMemo(
    () => ({
      paletteOpen,
      setPaletteOpen,
      togglePalette,
      captureOpen,
      setCaptureOpen,
      capture,
      captureProjectId,
      projectDialog,
      openProjectDialog,
      closeProjectDialog,
    }),
    [paletteOpen, togglePalette, captureOpen, capture, captureProjectId, projectDialog, openProjectDialog, closeProjectDialog],
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
