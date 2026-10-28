"use client";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { InsightList } from "@/components/insights/insight-list";
import { CardEmpty } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { shortDayLabel } from "@/lib/dates";
import type { InsightView } from "@/lib/insight-catalog";
import { saveWeeklyReview } from "@/server/actions/reviews";

type Kpi = { name: string; unit: string | null; projectName: string | null; direction: "up" | "down"; start: number | null; end: number | null };

const STEPS = ["Résultats", "Conseils", "Bilan", "Priorités"] as const;

export function WeeklyReview({
  start,
  timeZone,
  data,
  advice,
  openTasks,
}: {
  start: string;
  timeZone: string;
  data: {
    tasksDone: { title: string; projectName: string | null }[];
    overdue: string[];
    kpis: Kpi[];
    adviceApplied: number;
    resale: { soldCount: number; profitCents: number };
    content: { publishedCount: number; views: number };
    mistakes: string[];
  };
  advice: InsightView[];
  openTasks: { id: string; title: string; projectName: string | null; dueAt: Date | null }[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ proud: "", blocked: "", learned: "", next: "" });
  const [picked, setPicked] = useState<string[]>([]);
  const [newPriorities, setNewPriorities] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const total = picked.length + newPriorities.length;

  const finish = () =>
    startTransition(async () => {
      const result = await saveWeeklyReview({ start, answers, priorityTaskIds: picked, newPriorities });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Revue enregistrée", { description: "Tes priorités sont dans les tâches, échéance dimanche prochain." });
      router.push(`/bilans/${result.data.id}`);
    });

  const kpis = data.kpis.filter((k) => k.end !== null);

  return (
    <div className="mt-8">
      <ol className="flex gap-2" aria-label="Étapes">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <button
              type="button"
              onClick={() => setStep(i)}
              className={cn("w-full border-t-2 pt-2 text-left text-[12px] transition-colors", i <= step ? "border-primary text-foreground" : "border-border text-subtle")}
              aria-current={i === step ? "step" : undefined}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="surface mt-6 p-5">
        {step === 0 ? (
          <div className="grid gap-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Figure label="Tâches terminées" value={String(data.tasksDone.length)} />
              <Figure label="Conseils appliqués" value={String(data.adviceApplied)} />
              <Figure label="Ventes" value={data.resale.soldCount ? `${data.resale.soldCount} · ${(data.resale.profitCents / 100).toLocaleString("fr-FR")} €` : "0"} />
              <Figure label="Publications" value={data.content.publishedCount ? `${data.content.publishedCount} · ${data.content.views.toLocaleString("fr-FR")} vues` : "0"} />
            </div>
            {kpis.length ? (
              <ul className="grid gap-1.5 text-[13px]">
                {kpis.map((k) => {
                  const diff = k.start !== null && k.end !== null ? k.end - k.start : null;
                  const good = diff === null || diff === 0 ? null : k.direction === "up" ? diff > 0 : diff < 0;
                  return (
                    <li key={`${k.name}${k.projectName}`} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {k.name}
                        {k.projectName ? ` · ${k.projectName}` : ""}
                      </span>
                      <span className={cn("tabular-nums", good === null ? "text-foreground" : good ? "text-success" : "text-destructive")}>
                        {k.start ?? "—"} → {k.end}
                        {k.unit ? ` ${k.unit}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[12.5px] text-subtle">Aucun KPI relevé cette semaine : un check-in dans Objectifs & KPI rendra cette revue plus utile.</p>
            )}
            {data.tasksDone.length ? (
              <details className="text-[13px]">
                <summary className="cursor-pointer text-muted-foreground">Ce qui a été fait ({data.tasksDone.length})</summary>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground marker:text-subtle">
                  {data.tasksDone.map((t, i) => (
                    <li key={i}>
                      {t.title}
                      {t.projectName ? <span className="text-subtle"> · {t.projectName}</span> : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <Question label="De quoi es-tu le plus fier cette semaine ?" value={answers.proud} onChange={(proud) => setAnswers({ ...answers, proud })} />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-3">
            <p className="text-[13px] text-muted-foreground">
              Les conseils retenus mais pas encore appliqués. Marque ceux qui le sont, écarte ceux qui ne valent plus.
            </p>
            <InsightList insights={advice} timeZone={timeZone} empty={<CardEmpty>Aucun conseil en attente. Bien joué.</CardEmpty>} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-5">
            {data.overdue.length ? (
              <div>
                <p className="text-[12px] text-subtle">En retard</p>
                <ul className="mt-1 list-disc pl-5 text-[13px] text-muted-foreground marker:text-subtle">
                  {data.overdue.slice(0, 6).map((title, i) => (
                    <li key={i}>{title}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {data.mistakes.length ? (
              <div>
                <p className="text-[12px] text-subtle">Erreurs relevées cette semaine</p>
                <ul className="mt-1 list-disc pl-5 text-[13px] text-muted-foreground marker:text-subtle">
                  {data.mistakes.slice(0, 5).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Question label="Qu'est-ce qui a bloqué ou glissé ?" value={answers.blocked} onChange={(blocked) => setAnswers({ ...answers, blocked })} />
            <Question label="Que retiens-tu de cette semaine ?" value={answers.learned} onChange={(learned) => setAnswers({ ...answers, learned })} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4">
            <p className="text-[13px] text-muted-foreground">
              Choisis 3 priorités au plus pour la semaine prochaine. Elles passent en priorité haute, échéance dimanche prochain.
            </p>
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {openTasks.map((t) => {
                const checked = picked.includes(t.id);
                return (
                  <li key={t.id}>
                    <label className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/[0.03]", checked && "bg-primary/8")}>
                      <Checkbox
                        checked={checked}
                        disabled={!checked && total >= 3}
                        onCheckedChange={(value) => setPicked((current) => (value ? [...current, t.id] : current.filter((id) => id !== t.id)))}
                      />
                      <span className="min-w-0 flex-1 truncate text-foreground">{t.title}</span>
                      <span className="shrink-0 text-[11.5px] text-subtle">
                        {t.projectName ?? ""}
                        {t.dueAt ? ` · ${shortDayLabel(t.dueAt, timeZone)}` : ""}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {newPriorities.length ? (
              <ul className="space-y-1 text-[13px]">
                {newPriorities.map((title, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-primary/8 px-2 py-1.5 text-foreground">
                    {title}
                    <Button variant="ghost" size="icon-xs" aria-label="Retirer" onClick={() => setNewPriorities(newPriorities.filter((_, j) => j !== i))}>
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!draft.trim() || total >= 3) return;
                setNewPriorities([...newPriorities, draft.trim()]);
                setDraft("");
              }}
            >
              <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Nouvelle priorité" disabled={total >= 3} />
              <Button type="submit" variant="outline" disabled={!draft.trim() || total >= 3}>
                <PlusIcon /> Ajouter
              </Button>
            </form>
            <Question label="Un mot pour la semaine prochaine ?" value={answers.next} onChange={(next) => setAnswers({ ...answers, next })} />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex justify-between">
        <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>
          <ArrowLeftIcon /> Précédent
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)}>
            Suivant <ArrowRightIcon />
          </Button>
        ) : (
          <Button onClick={finish} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
            Terminer la revue
          </Button>
        )}
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.025] px-3 py-2.5">
      <p className="text-[11.5px] text-subtle">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Question({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-[13px]">
      <span className="text-foreground">{label}</span>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
    </label>
  );
}
