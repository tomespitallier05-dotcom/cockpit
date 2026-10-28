"use client";

import { PencilIcon } from "lucide-react";
import { useShell, type EditableProject } from "@/components/shell/shell-provider";
import { Button } from "@/components/ui/button";

export function EditProjectButton({ project }: { project: EditableProject }) {
  const { openProjectDialog } = useShell();
  return (
    <Button variant="outline" size="sm" onClick={() => openProjectDialog(project)}>
      <PencilIcon /> Modifier
    </Button>
  );
}

export function NewProjectButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { openProjectDialog } = useShell();
  return (
    <button type="button" onClick={() => openProjectDialog()} className={className}>
      {children}
    </button>
  );
}
