"use client";

import type { ComponentProps } from "react";
import { useShell } from "@/components/shell/shell-provider";
import { Button } from "@/components/ui/button";

/** A button that opens quick capture, optionally pre-filed into a project. */
export function CaptureButton({
  projectId,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick"> & { projectId?: string }) {
  const { capture } = useShell();
  return <Button size="sm" {...props} onClick={() => capture({ projectId })} />;
}
