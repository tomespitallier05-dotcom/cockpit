"use client";

import { FileAudioIcon, FileIcon, FileTextIcon, FileVideoIcon, ImageIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/format";
import { importDriveFile, listDriveFiles } from "@/server/actions/google";

type DriveFile = { id: string; name: string; mimeType: string; size: number | null; modifiedTime: string };

function iconFor(mimeType: string) {
  if (mimeType.startsWith("audio/")) return FileAudioIcon;
  if (mimeType.startsWith("video/")) return FileVideoIcon;
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.includes("document") || mimeType.startsWith("text/")) return FileTextIcon;
  return FileIcon;
}

/** Picks recent Drive files (Meet recordings and transcripts first) and copies them into the Inbox. */
export function DriveImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      startLoading(async () => {
        const result = await listDriveFiles(query);
        if (!result.ok) {
          toast.error(result.error);
          setFiles([]);
        } else {
          setFiles(result.data);
        }
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query]);

  const run = async (file: DriveFile) => {
    setImporting(file.id);
    const result = await importDriveFile(file.id);
    setImporting(null);
    if (!result.ok) return void toast.error(result.error);
    toast.success("Fichier importé", { description: "Transcription et analyse en cours." });
    onOpenChange(false);
    router.push(`/entrees/${result.data.entryId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer depuis Google Drive</DialogTitle>
          <DialogDescription>Enregistrements Meet, transcriptions, notes vocales, PDF. Le fichier est copié dans ton espace privé.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un fichier" className="pl-8" />
        </div>
        <ul className="-mx-2 max-h-80 overflow-y-auto">
          {files === null || (loading && files.length === 0) ? (
            <li className="flex items-center gap-2 px-2 py-4 text-[13px] text-subtle">
              <Loader2Icon className="size-3.5 animate-spin" /> Chargement…
            </li>
          ) : files.length === 0 ? (
            <li className="px-2 py-4 text-[13px] text-subtle">Aucun fichier importable.</li>
          ) : (
            files.map((file) => {
              const Icon = iconFor(file.mimeType);
              return (
                <li key={file.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.03]">
                  <Icon className="size-4 shrink-0 text-subtle" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-foreground">{file.name}</span>
                    <span className="block text-[11.5px] text-subtle">
                      {new Date(file.modifiedTime).toLocaleDateString("fr-FR")}
                      {file.size ? ` · ${formatBytes(file.size)}` : ""}
                    </span>
                  </span>
                  <Button size="xs" variant="outline" disabled={importing !== null} onClick={() => void run(file)}>
                    {importing === file.id ? <Loader2Icon className="animate-spin" /> : null}
                    Importer
                  </Button>
                </li>
              );
            })
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
