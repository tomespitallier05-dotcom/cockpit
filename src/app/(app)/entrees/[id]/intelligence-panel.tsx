"use client";

import { AlertTriangleIcon, FileTextIcon, Loader2Icon, LockIcon, SparklesIcon, WandSparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CardEmpty } from "@/components/section-card";
import { InsightList } from "@/components/insights/insight-list";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { entryTypeMeta } from "@/lib/entry-catalog";
import type { InsightView } from "@/lib/insight-catalog";
import { analyzeEntryNow, applySuggestion, setEntryPrivate } from "@/server/actions/insights";

type AiState = {
  status: "pending" | "processing" | "done" | "failed" | "skipped";
  processedAt?: string;
  error?: string;
  stale?: boolean;
};

export function IntelligencePanel({
  entryId,
  isPrivate,
  ai,
  configured,
  timeZone,
  insights,
  suggestion,
  files,
}: {
  entryId: string;
  isPrivate: boolean;
  ai: AiState | null;
  configured: boolean;
  timeZone: string;
  insights: InsightView[];
  suggestion: {
    summary: string | null;
    title: string | null;
    type: string | null;
    project: { id: string; name: string } | null;
    contacts: { id: string; name: string }[];
  };
  files: { id: string; fileName: string; kind: string; extractedText: string | null; processingStatus: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [privateEntry, setPrivateEntry] = useState(isPrivate);
  const working = ai?.status === "processing" || files.some((f) => f.processingStatus === "processing" || f.processingStatus === "pending");

  // Background processing (after a capture or an upload) finishes on its own: poll until it does.
  useEffect(() => {
    if (!working || privateEntry) return;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      router.refresh();
      if (ticks > 40) clearInterval(timer);
    }, 4000);
    return () => clearInterval(timer);
  }, [working, privateEntry, router]);

  const analyze = () =>
    startTransition(async () => {
      const result = await analyzeEntryNow(entryId);
      if (!result.ok) toast.error(result.error);
      else toast.success("Analyse terminée");
    });

  const apply = (input: Parameters<typeof applySuggestion>[1], label: string) =>
    startTransition(async () => {
      const result = await applySuggestion(entryId, input);
      if (!result.ok) toast.error(result.error);
      else toast.success(label);
    });

  const togglePrivate = (value: boolean) => {
    setPrivateEntry(value);
    startTransition(async () => {
      const result = await setEntryPrivate(entryId, value);
      if (!result.ok) {
        setPrivateEntry(!value);
        toast.error(result.error);
      }
    });
  };

  const hasSuggestion = suggestion.title || suggestion.type || suggestion.project || suggestion.contacts.length > 0;
  const label = ai?.status === "done" && ai.stale ? "Relancer l'analyse" : ai?.status === "done" ? "Relancer" : "Analyser";

  return (
    <section className="surface mt-8 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[13.5px] font-medium text-foreground">
            <SparklesIcon className="size-4 text-primary" aria-hidden />
            Analyse
          </h2>
          <p className="mt-0.5 text-[12.5px] text-subtle">
            {privateEntry
              ? "Entrée privée : jamais envoyée à l'IA."
              : working
                ? "Analyse en cours…"
                : ai?.status === "failed"
                  ? "La dernière analyse a échoué."
                  : ai?.status === "done"
                    ? ai.stale
                      ? "Le texte a changé depuis la dernière analyse."
                      : "Conseils, décisions et actions extraits de cette entrée. Rien n'est appliqué sans toi."
                    : "Extrait les conseils, décisions, actions et chiffres clés, avec leur source."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <LockIcon className="size-3.5" aria-hidden />
            Privée
            <Switch checked={privateEntry} onCheckedChange={togglePrivate} disabled={pending} aria-label="Exclure de l'IA" />
          </label>
          {!privateEntry ? (
            <Button variant="outline" size="sm" onClick={analyze} disabled={pending || working || !configured}>
              {pending || working ? <Loader2Icon className="animate-spin" /> : <WandSparklesIcon />}
              {label}
            </Button>
          ) : null}
        </div>
      </div>

      {!configured && !privateEntry ? (
        <p className="mt-3 text-[12.5px] text-subtle">
          L&apos;analyse s&apos;active quand la clé ANTHROPIC_API_KEY est ajoutée dans Vercel.
        </p>
      ) : null}
      {ai?.status === "failed" && ai.error ? (
        <p className="mt-3 flex items-start gap-2 text-[12.5px] text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {ai.error}
        </p>
      ) : null}

      {suggestion.summary && !privateEntry ? (
        <p className="mt-4 rounded-lg bg-white/[0.025] px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
          {suggestion.summary}
        </p>
      ) : null}

      {hasSuggestion && !privateEntry ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestion.project ? (
            <Button variant="secondary" size="xs" disabled={pending} onClick={() => apply({ projectId: suggestion.project!.id }, "Entrée classée")}>
              Classer dans « {suggestion.project.name} »
            </Button>
          ) : null}
          {suggestion.title ? (
            <Button variant="secondary" size="xs" disabled={pending} onClick={() => apply({ title: suggestion.title! }, "Titre appliqué")}>
              Titre : {suggestion.title}
            </Button>
          ) : null}
          {suggestion.type ? (
            <Button
              variant="secondary"
              size="xs"
              disabled={pending}
              onClick={() => apply({ type: suggestion.type as never }, "Type appliqué")}
            >
              Type : {entryTypeMeta(suggestion.type).label}
            </Button>
          ) : null}
          {suggestion.contacts.length ? (
            <Button
              variant="secondary"
              size="xs"
              disabled={pending}
              onClick={() => apply({ contactIds: suggestion.contacts.map((c) => c.id) }, "Contacts reliés")}
            >
              Relier {suggestion.contacts.map((c) => c.name).join(", ")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {!privateEntry ? (
        <div className="mt-4">
          <InsightList
            insights={insights}
            timeZone={timeZone}
            showSource={false}
            empty={
              ai?.status === "done" ? (
                <CardEmpty>Rien d&apos;actionnable repéré dans cette entrée.</CardEmpty>
              ) : null
            }
          />
        </div>
      ) : null}

      {files.length ? (
        <div className="mt-4 space-y-2">
          {files.map((file) => (
            <details key={file.id} className="rounded-lg border border-border bg-white/[0.015] px-3 py-2">
              <summary className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted-foreground">
                <FileTextIcon className="size-3.5" aria-hidden />
                {file.kind === "audio" || file.kind === "video" ? "Transcription" : "Texte extrait"} · {file.fileName}
                {file.processingStatus === "failed" ? <span className="text-destructive">· échec</span> : null}
                {file.processingStatus === "pending" || file.processingStatus === "processing" ? (
                  <Loader2Icon className="size-3 animate-spin" aria-hidden />
                ) : null}
              </summary>
              {file.extractedText ? (
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-muted-foreground">
                  {file.extractedText}
                </pre>
              ) : null}
            </details>
          ))}
        </div>
      ) : null}
    </section>
  );
}
