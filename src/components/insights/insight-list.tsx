"use client";

import { CheckIcon, ListPlusIcon, ListTodoIcon, RotateCcwIcon, SparklesIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { shortDayLabel } from "@/lib/dates";
import { insightTypeMeta, type InsightStatusKey, type InsightView } from "@/lib/insight-catalog";
import { insightToTask, setInsightStatus } from "@/server/actions/insights";

/**
 * Insights with the one-gesture decisions the product is built on:
 * keep or dismiss a proposal, turn an action into a task, mark advice applied.
 */
export function InsightList({
  insights,
  timeZone,
  showSource = true,
  empty,
}: {
  insights: InsightView[];
  timeZone: string;
  showSource?: boolean;
  empty?: React.ReactNode;
}) {
  // Optimistic overrides so a click is reflected before the server round trip.
  const [overrides, setOverrides] = useState<Record<string, { status?: InsightStatusKey; taskId?: string }>>({});
  const [pending, startTransition] = useTransition();

  if (insights.length === 0) return <>{empty ?? null}</>;

  const run = (item: InsightView, next: InsightStatusKey, label?: string) => {
    const previous = overrides[item.id];
    setOverrides((current) => ({ ...current, [item.id]: { ...current[item.id], status: next } }));
    startTransition(async () => {
      const result = await setInsightStatus(item.id, next);
      if (!result.ok) {
        toast.error(result.error);
        setOverrides((current) => ({ ...current, [item.id]: previous ?? {} }));
      } else if (label) {
        toast.success(label);
      }
    });
  };

  const toTask = (item: InsightView) => {
    startTransition(async () => {
      const result = await insightToTask(item.id);
      if (!result.ok) return void toast.error(result.error);
      setOverrides((current) => ({ ...current, [item.id]: { status: "accepted", taskId: result.data.taskId } }));
      toast.success("Tâche créée", { description: item.content });
    });
  };

  return (
    <ul className="-mx-2 divide-y divide-border">
      {insights.map((item) => {
        const status = overrides[item.id]?.status ?? item.status;
        const taskId = overrides[item.id]?.taskId ?? item.taskId;
        const meta = insightTypeMeta(item.type);
        const dimmed = status === "dismissed";
        return (
          <li key={item.id} className={cn("group flex gap-3 px-2 py-3", dimmed && "opacity-45")}>
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-subtle">
                <span className="font-medium" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                {status === "proposed" ? (
                  <span className="inline-flex items-center gap-1">
                    <SparklesIcon className="size-3" aria-hidden />
                    proposé par l&apos;IA
                  </span>
                ) : null}
                {status === "applied" && item.appliedAt ? <span>appliqué · {shortDayLabel(item.appliedAt, timeZone)}</span> : null}
                {status === "applied" && !item.appliedAt ? <span>appliqué</span> : null}
                {item.contactName ? <span>· {item.contactName}</span> : null}
              </div>
              <p className={cn("mt-0.5 text-[13.5px] leading-relaxed text-foreground", dimmed && "line-through")}>
                {item.content}
              </p>
              {item.quote && item.quote !== item.content ? (
                <p className="mt-1 line-clamp-2 border-l-2 border-white/10 pl-2 text-[12.5px] italic text-muted-foreground">
                  « {item.quote} »
                </p>
              ) : null}
              {showSource ? (
                <Link
                  href={`/entrees/${item.sourceEntryId}`}
                  className="mt-1 inline-block text-[11.5px] text-subtle transition-colors hover:text-foreground"
                >
                  {item.sourceTitle || "Sans titre"} · {shortDayLabel(item.sourceDate, timeZone)}
                  {item.projectName ? ` · ${item.projectName}` : ""}
                </Link>
              ) : null}
            </div>
            <div className="flex shrink-0 items-start gap-1 pt-0.5">
              {taskId ? (
                <Button asChild variant="ghost" size="xs" title="Voir la tâche">
                  <Link href={`/taches?tache=${taskId}`}>
                    <ListTodoIcon />
                    Tâche
                  </Link>
                </Button>
              ) : null}
              {!taskId && item.type === "action" && status !== "dismissed" ? (
                <Button variant="outline" size="xs" disabled={pending} onClick={() => toTask(item)}>
                  <ListPlusIcon />
                  Créer la tâche
                </Button>
              ) : null}
              {status === "proposed" && item.type !== "action" ? (
                <Button variant="outline" size="xs" disabled={pending} onClick={() => run(item, "accepted")}>
                  <CheckIcon />
                  Garder
                </Button>
              ) : null}
              {status === "accepted" && item.type === "advice" ? (
                <Button variant="outline" size="xs" disabled={pending} onClick={() => run(item, "applied", "Conseil appliqué")}>
                  <CheckIcon />
                  Appliqué
                </Button>
              ) : null}
              {status === "proposed" || status === "accepted" ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Écarter"
                  aria-label="Écarter"
                  disabled={pending}
                  onClick={() => run(item, "dismissed")}
                >
                  <XIcon />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Revenir en arrière"
                  aria-label="Revenir en arrière"
                  disabled={pending}
                  onClick={() => run(item, "accepted")}
                >
                  <RotateCcwIcon />
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
