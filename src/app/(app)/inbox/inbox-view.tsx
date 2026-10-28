"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckIcon, FolderInputIcon, InboxIcon, Loader2Icon, PartyPopperIcon, SparklesIcon, Trash2Icon, ZapIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { entryHeadline } from "@/components/entries/entry-timeline";
import { EntryTypeIcon } from "@/components/entry-type-icon";
import { ProjectPicker, type ProjectOption } from "@/components/pickers";
import { useShell } from "@/components/shell/shell-provider";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { dayLabel, timeLabel } from "@/lib/dates";
import { deleteEntry, restoreEntry, triageEntry } from "@/server/actions/entries";

export type InboxItem = {
  id: string;
  type: string;
  title: string | null;
  plainText: string;
  occurredAt: Date;
  /** The AI's filing suggestion, accepted with S. */
  suggestedProjectId?: string | null;
  summary?: string | null;
  analyzing?: boolean;
};

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/**
 * Keyboard-first triage. J/K move, Enter opens, E files without a project,
 * P files into a project, S accepts the AI's suggested project, Backspace deletes (undoable).
 */
export function InboxView({ items, projects, timeZone }: { items: InboxItem[]; projects: ProjectOption[]; timeZone: string }) {
  const router = useRouter();
  const { capture, paletteOpen, captureOpen } = useShell();
  // Triaged items disappear at once; the server list catches up on refresh.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const list = items.filter((item) => !hidden.has(item.id));
  const [cursor, setIndex] = useState(0);
  const index = Math.min(cursor, Math.max(list.length - 1, 0));
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  // "G then P" is the global shortcut to Projects: do not treat that P as "file".
  const lastKey = useRef<{ key: string; at: number }>({ key: "", at: 0 });

  // Braces matter: scrollIntoView returns a Promise in recent browsers, and an
  // effect must return nothing or a cleanup function.
  useEffect(() => {
    rows.current[index]?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const removeLocally = (id: string) => setHidden((current) => new Set(current).add(id));
  const restoreLocally = (id: string) =>
    setHidden((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });

  const file = (item: InboxItem, projectId?: string | null) => {
    removeLocally(item.id);
    startTransition(async () => {
      const result = await triageEntry(item.id, projectId);
      if (!result.ok) {
        toast.error(result.error);
        restoreLocally(item.id);
        return;
      }
      const project = projects.find((p) => p.id === projectId);
      toast.success(project ? `Classée dans ${project.name}` : "Classée");
    });
  };

  const remove = (item: InboxItem) => {
    removeLocally(item.id);
    startTransition(async () => {
      const result = await deleteEntry(item.id);
      if (!result.ok) {
        toast.error(result.error);
        restoreLocally(item.id);
        return;
      }
      toast("Entrée supprimée", { action: { label: "Annuler", onClick: () => void restoreEntry(item.id) } });
    });
  };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (paletteOpen || captureOpen || pickerFor || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const afterG = lastKey.current.key === "g" && Date.now() - lastKey.current.at < 900;
      lastKey.current = { key: event.key, at: Date.now() };
      if (afterG) return;
      const current = list[index];
      switch (event.key) {
        case "j":
        case "ArrowDown":
          event.preventDefault();
          setIndex(Math.min(index + 1, list.length - 1));
          break;
        case "k":
        case "ArrowUp":
          event.preventDefault();
          setIndex(Math.max(index - 1, 0));
          break;
        case "Enter":
          if (current) {
            event.preventDefault();
            router.push(`/entrees/${current.id}`);
          }
          break;
        case "e":
          if (current) {
            event.preventDefault();
            file(current, null);
          }
          break;
        case "s":
          if (current?.suggestedProjectId) {
            event.preventDefault();
            file(current, current.suggestedProjectId);
          }
          break;
        case "p":
          if (current) {
            event.preventDefault();
            setPickerFor(current.id);
          }
          break;
        case "Backspace":
        case "Delete":
        case "#":
          if (current) {
            event.preventDefault();
            remove(current);
          }
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (list.length === 0) {
    return (
      <div className="surface flex flex-col items-center px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-success/12 text-success">
          <PartyPopperIcon className="size-5" />
        </span>
        <h2 className="mt-5 text-[15px] font-medium text-foreground">Inbox zéro</h2>
        <p className="mt-1.5 max-w-sm text-[13.5px] text-muted-foreground">
          Tout est trié. Capture la prochaine idée, le prochain appel ou message en appuyant sur C.
        </p>
        <Button className="mt-6" onClick={() => capture()}>
          <ZapIcon /> Capturer
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 hidden flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-subtle md:flex">
        <span className="flex items-center gap-1.5"><Kbd>J</Kbd><Kbd>K</Kbd> naviguer</span>
        <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> ouvrir</span>
        <span className="flex items-center gap-1.5"><Kbd>P</Kbd> ranger dans un projet</span>
        <span className="flex items-center gap-1.5"><Kbd>S</Kbd> accepter la suggestion</span>
        <span className="flex items-center gap-1.5"><Kbd>E</Kbd> classer sans projet</span>
        <span className="flex items-center gap-1.5"><Kbd>⌫</Kbd> supprimer</span>
      </div>
      <ul className="surface divide-y divide-border overflow-hidden">
        <AnimatePresence initial={false}>
          {list.map((item, i) => {
            const selected = i === index;
            return (
              <motion.li
                key={item.id}
                ref={(node) => {
                  rows.current[i] = node;
                }}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                onMouseEnter={() => setIndex(i)}
                className={cn("group relative flex items-center gap-3 px-4 py-3 transition-colors", selected && "bg-white/[0.035]")}
              >
                {selected ? <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" /> : null}
                <button
                  type="button"
                  onClick={() => router.push(`/entrees/${item.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none"
                >
                  <EntryTypeIcon type={item.type} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-foreground">{entryHeadline(item)}</span>
                    <span className="block truncate text-[12px] text-subtle">
                      {dayLabel(item.occurredAt, timeZone)} · {timeLabel(item.occurredAt, timeZone)}
                      {item.summary ? ` · ${item.summary}` : ""}
                    </span>
                  </span>
                </button>
                {item.analyzing ? (
                  <Loader2Icon className="size-3.5 shrink-0 animate-spin text-subtle" aria-label="Analyse en cours" />
                ) : null}
                {item.suggestedProjectId ? (
                  <button
                    type="button"
                    onClick={() => file(item, item.suggestedProjectId)}
                    className="hidden shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11.5px] text-primary transition-colors hover:bg-primary/20 sm:flex"
                    title="Accepter la suggestion (S)"
                  >
                    <SparklesIcon className="size-3" aria-hidden />
                    {projects.find((p) => p.id === item.suggestedProjectId)?.name ?? "Projet suggéré"}
                  </button>
                ) : null}
                <div className={cn("flex shrink-0 items-center gap-1", !selected && "md:opacity-0 md:group-hover:opacity-100")}>
                  <ProjectPicker
                    projects={projects}
                    value={null}
                    open={pickerFor === item.id}
                    onOpenChange={(open) => setPickerFor(open ? item.id : null)}
                    onChange={(projectId) => {
                      setPickerFor(null);
                      if (projectId) file(item, projectId);
                    }}
                    emptyLabel="Garder dans l'Inbox"
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="Ranger dans un projet">
                        <FolderInputIcon />
                      </Button>
                    }
                  />
                  <Button variant="ghost" size="icon-sm" aria-label="Classer sans projet" onClick={() => file(item, null)}>
                    <CheckIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Supprimer" onClick={() => remove(item)}>
                    <Trash2Icon />
                  </Button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-subtle">
        <InboxIcon className="size-3.5" /> {list.length} élément{list.length > 1 ? "s" : ""} à trier
      </p>
    </div>
  );
}
