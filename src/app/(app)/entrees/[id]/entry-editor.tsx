"use client";

import type { JSONContent } from "@tiptap/react";
import {
  ArrowLeftIcon,
  CheckIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  InboxIcon,
  Loader2Icon,
  PinIcon,
  PinOffIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { RichEditor } from "@/components/editor/rich-editor";
import { EntryTypeIcon } from "@/components/entry-type-icon";
import { AttachmentsPanel, type AttachmentView } from "@/components/files/attachments-panel";
import { ContactPicker, ProjectPicker, type ContactOption, type ProjectOption } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toLocalInputValue } from "@/lib/dates";
import {
  CAPTURE_TYPES,
  ENTRY_TYPE_META,
  MESSAGE_CHANNELS,
  type CaptureType,
  type EntryMeta,
  type MessageChannel,
} from "@/lib/entry-catalog";
import type { UploadConfig } from "@/lib/upload-client";
import { deleteEntry, restoreEntry, setEntryContacts, updateEntry } from "@/server/actions/entries";

export type EditableEntry = {
  id: string;
  type: string;
  title: string | null;
  content: unknown;
  occurredAt: Date;
  meta: EntryMeta;
  inboxStatus: "inbox" | "processed";
  pinned: boolean;
  projectId: string | null;
  contactIds: string[];
  files: AttachmentView[];
};

type SaveState = "idle" | "saving" | "saved" | "error";
type Patch = Parameters<typeof updateEntry>[1];

/** Full-page editor for one entry. Everything autosaves; nothing needs a Save button. */
export function EntryEditor({
  entry,
  projects,
  contacts,
  uploadConfig,
  backHref,
  children,
}: {
  entry: EditableEntry;
  projects: ProjectOption[];
  contacts: ContactOption[];
  uploadConfig: UploadConfig;
  backHref: string;
  /** Server-rendered sections shown under the attachments (analysis, insights). */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [type, setType] = useState<CaptureType>((entry.type as CaptureType) ?? "note");
  const [title, setTitle] = useState(entry.title ?? "");
  const [projectId, setProjectId] = useState(entry.projectId);
  const [occurredAt, setOccurredAt] = useState(() => toLocalInputValue(entry.occurredAt));
  const [meta, setMeta] = useState<EntryMeta>(entry.meta);
  const [contactIds, setContactIds] = useState(entry.contactIds);
  const [pinned, setPinned] = useState(entry.pinned);
  const [inboxStatus, setInboxStatus] = useState(entry.inboxStatus);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [, startTransition] = useTransition();

  const pending = useRef<Patch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    setSaveState("saving");
    const result = await updateEntry(entry.id, patch);
    if (!result.ok) {
      setSaveState("error");
      toast.error("Modification non enregistrée", { description: result.error });
      return;
    }
    setSaveState("saved");
  }, [entry.id]);

  /** Text changes are batched; structural choices (project, type…) save at once. */
  const queue = useCallback(
    (patch: Patch, immediate = false) => {
      pending.current = { ...pending.current, ...patch };
      setSaveState("saving");
      clearTimeout(timer.current);
      if (immediate) void flush();
      else timer.current = setTimeout(() => void flush(), 700);
    },
    [flush],
  );

  // Never lose the last keystrokes when leaving the page.
  useEffect(() => {
    const onLeave = () => void flush();
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      void flush();
    };
  }, [flush]);

  const saveContacts = (ids: string[]) => {
    setContactIds(ids);
    startTransition(async () => {
      const result = await setEntryContacts(entry.id, ids, type === "message" ? "author" : "participant");
      if (!result.ok) toast.error(result.error);
    });
  };

  const remove = () =>
    startTransition(async () => {
      const result = await deleteEntry(entry.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast("Entrée supprimée", {
        action: {
          label: "Annuler",
          onClick: async () => {
            await restoreEntry(entry.id);
            router.push(`/entrees/${entry.id}`);
          },
        },
      });
      router.push(backHref);
    });

  const metaInput = (patch: Partial<EntryMeta>) => {
    const next = { ...meta, ...patch };
    setMeta(next);
    queue({ meta: next });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4 pb-28 sm:px-8 md:pt-8">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href={backHref}>
            <ArrowLeftIcon /> Retour
          </Link>
        </Button>
        <span
          aria-live="polite"
          className={cn(
            "ml-auto flex items-center gap-1.5 text-[12px]",
            saveState === "error" ? "text-destructive" : "text-subtle",
          )}
        >
          {saveState === "saving" ? <Loader2Icon className="size-3 animate-spin" /> : null}
          {saveState === "saved" ? <CheckIcon className="size-3" /> : null}
          {saveState === "saving" ? "Enregistrement…" : saveState === "saved" ? "Enregistré" : saveState === "error" ? "Non enregistré" : ""}
        </span>
        {inboxStatus === "inbox" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setInboxStatus("processed");
              queue({ inboxStatus: "processed" }, true);
              toast.success("Classée", { description: "L'entrée a quitté l'Inbox." });
            }}
          >
            <CheckIcon /> Classer
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Plus d'actions">
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onSelect={() => {
                setPinned(!pinned);
                queue({ pinned: !pinned }, true);
              }}
            >
              {pinned ? <PinOffIcon /> : <PinIcon />}
              {pinned ? "Désépingler" : "Épingler en haut"}
            </DropdownMenuItem>
            {inboxStatus === "processed" ? (
              <DropdownMenuItem
                onSelect={() => {
                  setInboxStatus("inbox");
                  queue({ inboxStatus: "inbox" }, true);
                }}
              >
                <InboxIcon /> Remettre dans l&apos;Inbox
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={remove}>
              <Trash2Icon /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <EntryTypeIcon type={type} className="size-9 rounded-xl [&_svg]:size-4" />
        <Select
          value={type}
          onValueChange={(value) => {
            setType(value as CaptureType);
            queue({ type: value as CaptureType }, true);
          }}
        >
          <SelectTrigger size="sm" className="w-auto gap-2 border-none bg-transparent px-1 text-[13px] text-muted-foreground shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CAPTURE_TYPES.map((key) => (
              <SelectItem key={key} value={key}>
                {ENTRY_TYPE_META[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <input
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          queue({ title: event.target.value });
        }}
        placeholder="Sans titre"
        aria-label="Titre"
        className="mt-3 w-full bg-transparent text-[28px] leading-tight font-semibold tracking-[-0.02em] text-foreground outline-none placeholder:text-subtle"
      />

      <div className="mt-5 grid gap-x-4 gap-y-2.5 rounded-xl border border-border bg-white/[0.015] p-3 text-[13px] sm:grid-cols-[120px_1fr]">
        <span className="self-center text-subtle">Projet</span>
        <div>
          <ProjectPicker
            projects={projects}
            value={projectId}
            onChange={(value) => {
              setProjectId(value);
              queue({ projectId: value }, true);
            }}
            emptyLabel="Aucun projet"
          />
        </div>

        <span className="self-center text-subtle">Date</span>
        <input
          type="datetime-local"
          value={occurredAt}
          onChange={(event) => {
            setOccurredAt(event.target.value);
            if (event.target.value) queue({ occurredAt: new Date(event.target.value) });
          }}
          className="h-8 w-fit rounded-lg border border-border bg-white/[0.02] px-2.5 text-[13px] text-foreground [color-scheme:dark]"
        />

        {type === "call" || type === "message" || type === "note" ? (
          <>
            <span className="self-center text-subtle">{type === "message" ? "De" : "Avec"}</span>
            <ContactPicker
              contacts={contacts}
              value={contactIds}
              onChange={saveContacts}
              placeholder={type === "message" ? "Qui a envoyé ce message ?" : "Personnes concernées"}
            />
          </>
        ) : null}

        {type === "call" ? (
          <>
            <span className="self-center text-subtle">Durée</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={meta.durationMinutes ?? ""}
                onChange={(event) =>
                  metaInput({ durationMinutes: event.target.value ? Number(event.target.value) : undefined })
                }
                className="h-8 w-24"
              />
              <span className="text-subtle">minutes</span>
            </div>
          </>
        ) : null}

        {type === "message" ? (
          <>
            <span className="self-center text-subtle">Canal</span>
            <Select value={meta.channel ?? ""} onValueChange={(value) => metaInput({ channel: value as MessageChannel })}>
              <SelectTrigger size="sm" className="w-44">
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MESSAGE_CHANNELS) as MessageChannel[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {MESSAGE_CHANNELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}

        {type === "link" ? (
          <>
            <span className="self-center text-subtle">Adresse</span>
            <div className="flex items-center gap-2">
              <Input
                type="url"
                placeholder="https://…"
                value={meta.url ?? ""}
                onChange={(event) => metaInput({ url: event.target.value })}
                className="h-8"
              />
              {meta.url ? (
                <Button asChild variant="ghost" size="icon-sm" aria-label="Ouvrir le lien">
                  <a href={meta.url} target="_blank" rel="noreferrer noopener">
                    <ExternalLinkIcon />
                  </a>
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-8">
        <RichEditor
          content={(entry.content as JSONContent | null) ?? null}
          placeholder={`${ENTRY_TYPE_META[type].placeholder} Tape « # » pour un titre, « - » pour une liste.`}
          onChange={(doc, text) => queue({ content: doc as Record<string, unknown>, plainText: text })}
        />
      </div>

      <div className="mt-10">
        <AttachmentsPanel entryId={entry.id} files={entry.files} uploadConfig={uploadConfig} />
      </div>
      {children}
    </div>
  );
}
