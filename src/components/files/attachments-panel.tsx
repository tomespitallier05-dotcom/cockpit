"use client";

import { DownloadIcon, FileIcon, FileTextIcon, ImageIcon, Loader2Icon, PaperclipIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type DragEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { uploadFile, type UploadConfig } from "@/lib/upload-client";
import { deleteAttachment } from "@/server/actions/files";

export type AttachmentView = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
};

function KindIcon({ kind }: { kind: string }) {
  if (kind === "image") return <ImageIcon />;
  if (kind === "pdf" || kind === "document") return <FileTextIcon />;
  return <FileIcon />;
}

/** Files of one entry: drop or pick to upload, preview images, download, delete. */
export function AttachmentsPanel({
  entryId,
  files,
  uploadConfig,
}: {
  entryId: string;
  files: AttachmentView[];
  uploadConfig: UploadConfig;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [removing, startRemoving] = useTransition();

  const send = async (list: File[]) => {
    if (list.length === 0) return;
    for (const file of list) {
      setProgress((current) => ({ ...current, [file.name]: 0 }));
      try {
        await uploadFile(file, uploadConfig, {
          entryId,
          onProgress: (value) => setProgress((current) => ({ ...current, [file.name]: value })),
        });
      } catch (error) {
        toast.error(`${file.name} n'a pas été envoyé`, { description: error instanceof Error ? error.message : undefined });
      } finally {
        setProgress((current) => {
          const next = { ...current };
          delete next[file.name];
          return next;
        });
      }
    }
    // Local uploads go through a Route Handler, which cannot refresh the page itself.
    router.refresh();
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void send(Array.from(event.dataTransfer.files));
  };

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "rounded-xl border border-dashed p-3 transition-colors",
        dragging ? "border-primary/60 bg-primary/5" : "border-white/[0.08]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[12.5px] font-medium text-muted-foreground">
          <PaperclipIcon className="size-3.5" /> Fichiers
          {files.length ? <span className="text-subtle">{files.length}</span> : null}
        </h2>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            void send(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <Button type="button" variant="ghost" size="sm" onClick={() => input.current?.click()}>
          <UploadIcon /> Ajouter
        </Button>
      </div>

      {Object.entries(progress).map(([name, value]) => (
        <div key={name} className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" />
          <span className="truncate">{name}</span>
          <span className="ml-auto tabular-nums text-subtle">{Math.round(value)} %</span>
        </div>
      ))}

      {files.length ? (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {files.map((file) => (
            <li key={file.id} className="group/file overflow-hidden rounded-lg border border-border bg-white/[0.015]">
              {file.kind === "image" ? (
                <a href={`/api/fichiers/${file.id}`} target="_blank" rel="noreferrer" className="block bg-black/20">
                  {/* Private, auth-checked route: next/image can't optimise it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/fichiers/${file.id}`} alt={file.fileName} className="h-36 w-full object-cover" loading="lazy" />
                </a>
              ) : null}
              <div className="flex items-center gap-2 px-2.5 py-2 text-[12.5px] [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-subtle">
                <KindIcon kind={file.kind} />
                <a
                  href={`/api/fichiers/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-foreground hover:underline"
                >
                  {file.fileName}
                </a>
                <span className="shrink-0 text-subtle">{formatBytes(file.sizeBytes)}</span>
                <a
                  href={`/api/fichiers/${file.id}?download=1`}
                  aria-label={`Télécharger ${file.fileName}`}
                  className="rounded p-1 text-subtle hover:bg-white/10 hover:text-foreground"
                >
                  <DownloadIcon className="size-3.5" />
                </a>
                <button
                  type="button"
                  aria-label={`Supprimer ${file.fileName}`}
                  disabled={removing}
                  onClick={() =>
                    startRemoving(async () => {
                      const result = await deleteAttachment(file.id);
                      if (!result.ok) toast.error(result.error);
                    })
                  }
                  className="rounded p-1 text-subtle hover:bg-white/10 hover:text-destructive"
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[12px] text-subtle">Glisse des fichiers ici : photos, captures, PDF, tableurs, audio…</p>
      )}
    </section>
  );
}
