"use client";

import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatChartValue } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteContentItem, moveContentItem, saveContentItem } from "@/server/actions/modules";

const STAGES = [
  { key: "idea", label: "Idées" },
  { key: "script", label: "Script" },
  { key: "shoot", label: "Tournage" },
  { key: "edit", label: "Montage" },
  { key: "scheduled", label: "Programmé" },
  { key: "published", label: "Publié" },
] as const;
type Stage = (typeof STAGES)[number]["key"];

const FORMATS = { reel: "Reel", carousel: "Carrousel", story: "Story", post: "Post", video: "Vidéo", other: "Autre" } as const;
type Format = keyof typeof FORMATS;

type Stats = { views?: number; likes?: number; comments?: number; saves?: number; shares?: number; followers?: number };
export type ContentItem = {
  id: string;
  title: string;
  format: Format;
  stage: Stage;
  hook: string | null;
  notes: string | null;
  scheduledOn: string | null;
  publishedOn: string | null;
  url: string | null;
  stats: Stats;
};

const STAT_FIELDS = [
  ["views", "Vues"],
  ["likes", "J'aime"],
  ["comments", "Commentaires"],
  ["saves", "Enregistrements"],
  ["shares", "Partages"],
  ["followers", "Abonnés gagnés"],
] as const;

export function ContentPipeline({ projectId, items }: { projectId: string; items: ContentItem[] }) {
  const [editing, setEditing] = useState<ContentItem | Stage | null>(null);
  const [moved, setMoved] = useState<Record<string, Stage>>({});
  const [, startTransition] = useTransition();
  const stageOf = (item: ContentItem) => moved[item.id] ?? item.stage;

  const move = (item: ContentItem, direction: -1 | 1) => {
    const index = STAGES.findIndex((s) => s.key === stageOf(item));
    const next = STAGES[index + direction]?.key;
    if (!next) return;
    setMoved((current) => ({ ...current, [item.id]: next }));
    startTransition(async () => {
      const result = await moveContentItem(item.id, next);
      if (!result.ok) {
        toast.error(result.error);
        setMoved((current) => ({ ...current, [item.id]: item.stage }));
      }
    });
  };

  const published = items.filter((i) => stageOf(i) === "published");
  const withViews = published.filter((i) => typeof i.stats.views === "number");
  const byFormat = Object.entries(
    withViews.reduce<Record<string, number[]>>((acc, item) => {
      (acc[item.format] ??= []).push(item.stats.views ?? 0);
      return acc;
    }, {}),
  )
    .map(([format, views]) => ({ format: format as Format, avg: views.reduce((a, b) => a + b, 0) / views.length, count: views.length }))
    .sort((a, b) => b.avg - a.avg);
  const top = [...withViews].sort((a, b) => (b.stats.views ?? 0) - (a.stats.views ?? 0)).slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      {withViews.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="surface px-4 py-3.5">
            <p className="text-[12px] text-subtle">Vues moyennes</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              {formatChartValue(withViews.reduce((a, i) => a + (i.stats.views ?? 0), 0) / withViews.length)}
            </p>
            <p className="mt-0.5 text-[11.5px] text-subtle">sur {withViews.length} publication{withViews.length > 1 ? "s" : ""} mesurée{withViews.length > 1 ? "s" : ""}</p>
          </div>
          <div className="surface px-4 py-3.5">
            <p className="text-[12px] text-subtle">Meilleur format</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{byFormat[0] ? FORMATS[byFormat[0].format] : "—"}</p>
            <p className="mt-0.5 text-[11.5px] text-subtle">
              {byFormat[0] ? `${formatChartValue(byFormat[0].avg)} vues en moyenne` : ""}
            </p>
          </div>
          <div className="surface px-4 py-3.5">
            <p className="text-[12px] text-subtle">Accroches qui marchent</p>
            <ul className="mt-1 space-y-0.5 text-[12.5px] text-muted-foreground">
              {top.map((item) => (
                <li key={item.id} className="truncate">
                  <span className="tabular-nums text-foreground">{formatChartValue(item.stats.views ?? 0)}</span> · {item.hook || item.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[960px] grid-cols-6 gap-3">
          {STAGES.map((stage) => {
            const column = items.filter((item) => stageOf(item) === stage.key);
            return (
              <section key={stage.key} className="flex min-h-48 flex-col rounded-xl border border-border bg-white/[0.015] p-2">
                <header className="flex items-center justify-between px-1.5 py-1">
                  <h3 className="text-[12.5px] font-medium text-foreground">
                    {stage.label} <span className="text-subtle">{column.length}</span>
                  </h3>
                  <Button variant="ghost" size="icon-xs" aria-label={`Ajouter dans ${stage.label}`} onClick={() => setEditing(stage.key)}>
                    <PlusIcon />
                  </Button>
                </header>
                <ul className="mt-1 flex flex-col gap-2">
                  {column.map((item) => {
                    const index = STAGES.findIndex((s) => s.key === stageOf(item));
                    return (
                      <li key={item.id} className="surface group p-2.5">
                        <button type="button" onClick={() => setEditing(item)} className="block w-full text-left">
                          <span className="block text-[11px] text-subtle">{FORMATS[item.format]}</span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-foreground">{item.title}</span>
                          {item.hook ? <span className="mt-1 line-clamp-2 block text-[12px] italic text-muted-foreground">« {item.hook} »</span> : null}
                          {stageOf(item) === "published" && typeof item.stats.views === "number" ? (
                            <span className="mt-1 block text-[11.5px] tabular-nums text-subtle">{formatChartValue(item.stats.views)} vues</span>
                          ) : null}
                        </button>
                        <div className="mt-2 flex justify-between opacity-60 transition-opacity group-hover:opacity-100">
                          <Button variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => move(item, -1)} aria-label="Étape précédente">
                            <ChevronLeftIcon />
                          </Button>
                          <Button variant="ghost" size="icon-xs" disabled={index === STAGES.length - 1} onClick={() => move(item, 1)} aria-label="Étape suivante">
                            <ChevronRightIcon />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {editing ? (
        <ContentDialog
          projectId={projectId}
          item={typeof editing === "string" ? null : editing}
          stage={typeof editing === "string" ? editing : editing.stage}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function ContentDialog({ projectId, item, stage, onClose }: { projectId: string; item: ContentItem | null; stage: Stage; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: item?.title ?? "",
    format: item?.format ?? ("reel" as Format),
    stage: item?.stage ?? stage,
    hook: item?.hook ?? "",
    notes: item?.notes ?? "",
    scheduledOn: item?.scheduledOn ?? "",
    publishedOn: item?.publishedOn ?? "",
    url: item?.url ?? "",
  });
  const [stats, setStats] = useState<Record<string, string>>(
    Object.fromEntries(STAT_FIELDS.map(([key]) => [key, item?.stats[key] != null ? String(item.stats[key]) : ""])),
  );

  const save = () =>
    startTransition(async () => {
      const parsedStats = Object.fromEntries(
        Object.entries(stats)
          .filter(([, value]) => value.trim() !== "")
          .map(([key, value]) => [key, Math.round(Number(value.replace(/\s/g, "")))]),
      );
      if (Object.values(parsedStats).some((n) => !Number.isFinite(n))) return void toast.error("Une statistique n'est pas un nombre.");
      const result = await saveContentItem(item?.id ?? null, {
        projectId,
        ...form,
        scheduledOn: form.scheduledOn || null,
        publishedOn: form.publishedOn || null,
        url: form.url || null,
        stats: parsedStats,
      });
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
      onClose();
    });

  const remove = () =>
    startTransition(async () => {
      if (!item) return;
      const result = await deleteContentItem(item.id);
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
      onClose();
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Contenu" : "Nouveau contenu"}</DialogTitle>
          <DialogDescription>Une fois publié, note ses chiffres : c&apos;est ce qui dira quels formats et quelles accroches marchent.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3 text-[13px]"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label className="grid gap-1.5">
            <span className="text-muted-foreground">Titre</span>
            <Input autoFocus={!item} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <span className="text-muted-foreground">Format</span>
              <Select value={form.format} onValueChange={(value) => setForm({ ...form, format: value as Format })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMATS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <span className="text-muted-foreground">Étape</span>
              <Select value={form.stage} onValueChange={(value) => setForm({ ...form, stage: value as Stage })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground">Accroche (les 3 premières secondes)</span>
            <Input value={form.hook} onChange={(event) => setForm({ ...form, hook: event.target.value })} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground">Notes, script</span>
            <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="text-muted-foreground">Programmé le</span>
              <Input type="date" value={form.scheduledOn} onChange={(event) => setForm({ ...form, scheduledOn: event.target.value })} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-muted-foreground">Publié le</span>
              <Input type="date" value={form.publishedOn} onChange={(event) => setForm({ ...form, publishedOn: event.target.value })} />
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="flex items-center justify-between text-muted-foreground">
              Lien
              {form.url ? (
                <a href={form.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-subtle hover:text-foreground">
                  Ouvrir <ExternalLinkIcon className="size-3" />
                </a>
              ) : null}
            </span>
            <Input type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://www.instagram.com/reel/…" />
          </label>
          {form.stage === "published" ? (
            <div className="grid grid-cols-3 gap-3">
              {STAT_FIELDS.map(([key, label]) => (
                <label key={key} className="grid gap-1.5">
                  <span className="text-muted-foreground">{label}</span>
                  <Input inputMode="numeric" value={stats[key]} onChange={(event) => setStats({ ...stats, [key]: event.target.value })} />
                </label>
              ))}
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            {item ? (
              <Button type="button" variant="ghost" onClick={remove} disabled={pending}>
                <Trash2Icon /> Supprimer
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending || !form.title.trim()}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
