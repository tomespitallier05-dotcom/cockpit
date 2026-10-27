"use client";

import { Loader2Icon, PaperclipIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { EntryTypeIcon } from "@/components/entry-type-icon";
import { ProjectPicker, type ProjectOption } from "@/components/pickers";
import { useShell } from "@/components/shell/shell-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ENTRY_TYPE_META, type CaptureType } from "@/lib/entry-catalog";
import { formatBytes } from "@/lib/format";
import { uploadFile, type UploadConfig } from "@/lib/upload-client";
import { createEntry } from "@/server/actions/entries";

const QUICK_TYPES: CaptureType[] = ["note", "call", "message", "link", "journal"];

/** Quick capture: the fastest path from a thought to the app, in under 5 seconds. */
export function CaptureDialog({ projects, uploadConfig }: { projects: ProjectOption[]; uploadConfig: UploadConfig | null }) {
  const router = useRouter();
  const { captureOpen, setCaptureOpen, captureProjectId } = useShell();
  const [type, setType] = useState<CaptureType>("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!captureOpen) return;
    setType("note");
    setTitle("");
    setBody("");
    setUrl("");
    setFiles([]);
    setProjectId(captureProjectId);
  }, [captureOpen, captureProjectId]);

  const empty = !title.trim() && !body.trim() && !url.trim() && files.length === 0;

  const save = () => {
    if (empty || pending) return;
    startTransition(async () => {
      const result = await createEntry({
        type: files.length && type === "note" && !body.trim() ? "file" : type,
        title: title.trim() || (files.length === 1 && !body.trim() ? files[0].name : ""),
        body,
        projectId,
        meta: type === "link" && url.trim() ? { url: url.trim() } : {},
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const entryId = result.data.id;
      if (files.length && uploadConfig) {
        const failures: string[] = [];
        for (const file of files) {
          try {
            await uploadFile(file, uploadConfig, { entryId });
          } catch (error) {
            failures.push(`${file.name} : ${error instanceof Error ? error.message : "échec"}`);
          }
        }
        if (failures.length) toast.error("Certains fichiers n'ont pas été envoyés", { description: failures.join("\n") });
      }
      setCaptureOpen(false);
      toast.success(projectId ? "Entrée enregistrée" : "Capturé dans l'Inbox", {
        action: { label: "Ouvrir", onClick: () => router.push(`/entrees/${entryId}`) },
      });
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save();
  };

  return (
    <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
      <DialogContent
        className="top-[12%] translate-y-0 gap-0 p-0 sm:max-w-xl"
        showCloseButton={false}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            save();
          }
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Capturer</DialogTitle>
          <DialogDescription>Note, appel, message ou lien, en quelques secondes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="flex flex-wrap gap-1 border-b border-border p-2">
            {QUICK_TYPES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                aria-pressed={type === key}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium transition-colors",
                  type === key ? "bg-white/[0.07] text-foreground" : "text-subtle hover:text-muted-foreground",
                )}
              >
                <EntryTypeIcon type={key} className="size-5 rounded-md [&_svg]:size-3" />
                {ENTRY_TYPE_META[key].label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1 px-4 pt-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Titre (facultatif)"
              className="h-9 bg-transparent text-[16px] font-medium text-foreground outline-none placeholder:text-subtle"
            />
            {type === "link" ? (
              <Input
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="my-1"
              />
            ) : null}
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={ENTRY_TYPE_META[type].placeholder}
              rows={6}
              autoFocus
              className="min-h-36 resize-none bg-transparent text-[14px] leading-relaxed text-foreground outline-none placeholder:text-subtle"
            />
          </div>

          {files.length ? (
            <ul className="flex flex-wrap gap-1.5 px-4 pb-2">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-white/[0.02] py-1 pr-1 pl-2 text-[12px] text-muted-foreground"
                >
                  <span className="max-w-40 truncate">{file.name}</span>
                  <span className="text-subtle">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    aria-label={`Retirer ${file.name}`}
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    className="rounded p-0.5 hover:bg-white/10"
                  >
                    <XIcon className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2.5">
            <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                setFiles((current) => [...current, ...Array.from(event.target.files ?? [])]);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInput.current?.click()}
              disabled={!uploadConfig}
            >
              <PaperclipIcon />
              Joindre
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <KbdGroup className="hidden sm:inline-flex">
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd>
              </KbdGroup>
              <Button type="submit" size="sm" disabled={empty || pending}>
                {pending ? <Loader2Icon className="animate-spin" /> : null}
                Enregistrer
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
