"use client";

import {
  ArchiveIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ClipboardCheckIcon,
  FlagIcon,
  GaugeIcon,
  Loader2Icon,
  PlusIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { formatChartValue, LineChart, ProgressMeter, Sparkline } from "@/components/charts";
import { ProjectPicker, type ProjectOption } from "@/components/pickers";
import { CardEmpty } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { archiveMetric, createGoal, createMetric, recordMetricValues, setGoalStatus } from "@/server/actions/goals";

type Metric = {
  id: string;
  name: string;
  unit: string | null;
  direction: "up" | "down";
  aggregation: "last" | "sum" | "avg";
  projectId: string | null;
  projectName: string | null;
  series: { date: string; value: number }[];
  latest: { date: string; value: number } | null;
  previous: { date: string; value: number } | null;
};

type Goal = {
  id: string;
  title: string;
  period: string;
  startsOn: string;
  endsOn: string;
  kind: "metric" | "milestone";
  status: string;
  projectName: string | null;
  metricName: string | null;
  unit: string | null;
  targetValue: number | null;
  currentValue: number | null;
  progress: number;
  expected: number;
  daysLeft: number;
};

const AGGREGATIONS = { last: "Dernière valeur", sum: "Somme sur la période", avg: "Moyenne" } as const;

function longDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function GoalsView({
  goals,
  metrics,
  projects,
  today,
  projectId,
}: {
  goals: Goal[];
  metrics: Metric[];
  projects: ProjectOption[];
  today: string;
  /** Scope new metrics and goals to one project (project page tab). */
  projectId?: string;
}) {
  const [dialog, setDialog] = useState<"checkin" | "metric" | "goal" | null>(null);
  const [detail, setDetail] = useState<Metric | null>(null);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setDialog("checkin")} disabled={metrics.length === 0}>
          <ClipboardCheckIcon /> Check-in
        </Button>
        <Button variant="outline" onClick={() => setDialog("metric")}>
          <GaugeIcon /> Nouvel indicateur
        </Button>
        <Button variant="outline" onClick={() => setDialog("goal")}>
          <FlagIcon /> Nouvel objectif
        </Button>
      </div>

      <section>
        <h2 className="mb-3 text-[13.5px] font-medium text-foreground">Objectifs en cours</h2>
        {goals.length ? (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </ul>
        ) : (
          <CardEmpty>
            Aucun objectif. Un bon objectif est relié à un indicateur : « 1 500 € de CA en novembre », « 3 reels par semaine ».
          </CardEmpty>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[13.5px] font-medium text-foreground">Indicateurs</h2>
        {metrics.length ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((item) => (
              <MetricCard key={item.id} metric={item} onOpen={() => setDetail(item)} />
            ))}
          </ul>
        ) : (
          <CardEmpty>
            Choisis 3 à 5 chiffres par projet : chiffre d&apos;affaires, marge, abonnés, ventes… Sans eux, « analyse mon évolution » n&apos;a pas de sens.
          </CardEmpty>
        )}
      </section>

      {dialog === "checkin" ? <CheckInDialog metrics={metrics} today={today} onClose={() => setDialog(null)} /> : null}
      {dialog === "metric" ? <MetricDialog projects={projects} projectId={projectId} onClose={() => setDialog(null)} /> : null}
      {dialog === "goal" ? (
        <GoalDialog projects={projects} metrics={metrics} today={today} projectId={projectId} onClose={() => setDialog(null)} />
      ) : null}
      {detail ? <MetricDetail metric={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}

function Delta({ metric }: { metric: Metric }) {
  if (!metric.latest || !metric.previous) return null;
  const diff = metric.latest.value - metric.previous.value;
  if (diff === 0) return <span className="text-[12px] text-subtle">stable</span>;
  const good = metric.direction === "up" ? diff > 0 : diff < 0;
  const Icon = diff > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12px] tabular-nums", good ? "text-success" : "text-destructive")}>
      <Icon className="size-3.5" aria-hidden />
      {diff > 0 ? "+" : "−"}
      {formatChartValue(Math.abs(diff), metric.unit)}
      <span className="ml-1 text-subtle">vs {longDate(metric.previous.date)}</span>
    </span>
  );
}

function MetricCard({ metric, onOpen }: { metric: Metric; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="surface w-full p-4 text-left transition-colors hover:border-white/12">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[12.5px] text-muted-foreground">{metric.name}</p>
            {metric.projectName ? <p className="truncate text-[11.5px] text-subtle">{metric.projectName}</p> : null}
          </div>
          {metric.direction === "down" ? (
            <TrendingDownIcon className="size-3.5 shrink-0 text-subtle" aria-label="Plus bas, c'est mieux" />
          ) : (
            <TrendingUpIcon className="size-3.5 shrink-0 text-subtle" aria-label="Plus haut, c'est mieux" />
          )}
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {metric.latest ? formatChartValue(metric.latest.value, metric.unit) : "—"}
        </p>
        <div className="mt-0.5 min-h-4">
          {metric.latest ? <Delta metric={metric} /> : <span className="text-[12px] text-subtle">Aucune valeur : fais un check-in</span>}
        </div>
        <Sparkline values={metric.series.slice(-12).map((p) => p.value)} className="mt-3" label={`Évolution de ${metric.name}`} />
      </button>
    </li>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const [pending, startTransition] = useTransition();
  const ahead = goal.progress - goal.expected;
  const pace =
    goal.kind === "milestone"
      ? `${goal.daysLeft} j restants`
      : ahead >= 0.05
        ? "En avance sur le rythme"
        : ahead <= -0.1
          ? "En retard sur le rythme"
          : "Dans le rythme";
  const close = (status: "achieved" | "dropped") =>
    startTransition(async () => {
      const result = await setGoalStatus(goal.id, status);
      if (!result.ok) toast.error(result.error);
      else toast.success(status === "achieved" ? "Objectif atteint, bravo" : "Objectif abandonné");
    });
  return (
    <li className="surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-foreground">{goal.title}</p>
          <p className="mt-0.5 text-[12px] text-subtle">
            {longDate(goal.startsOn)} → {longDate(goal.endsOn)}
            {goal.projectName ? ` · ${goal.projectName}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon-xs" title="Atteint" aria-label="Marquer atteint" disabled={pending} onClick={() => close("achieved")}>
            <CheckIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" title="Abandonner" aria-label="Abandonner" disabled={pending} onClick={() => close("dropped")}>
            <XIcon />
          </Button>
        </div>
      </div>
      {goal.kind === "metric" ? (
        <>
          <div className="mt-4">
            <ProgressMeter value={goal.progress} expected={goal.expected} label={`Progression de ${goal.title}`} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {goal.currentValue === null ? "—" : formatChartValue(goal.currentValue, goal.unit)}
              </span>{" "}
              / {goal.targetValue === null ? "—" : formatChartValue(goal.targetValue, goal.unit)}
              {goal.metricName ? ` · ${goal.metricName}` : ""}
            </span>
            <span className={cn(ahead <= -0.1 ? "text-warning" : "text-subtle")}>
              {Math.round(goal.progress * 100)} % · {pace}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-3 text-[12px] text-subtle">Jalon · {pace}</p>
      )}
    </li>
  );
}

function CheckInDialog({ metrics, today, onClose }: { metrics: Metric[]; today: string; onClose: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const save = () =>
    startTransition(async () => {
      const rows = Object.entries(values)
        .filter(([, value]) => value.trim() !== "")
        .map(([metricId, value]) => ({ metricId, date, value: Number(value.replace(",", ".")) }));
      if (rows.some((row) => !Number.isFinite(row.value))) return void toast.error("Une valeur n'est pas un nombre.");
      const result = await recordMetricValues(rows);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${result.data.saved} valeur${result.data.saved > 1 ? "s" : ""} enregistrée${result.data.saved > 1 ? "s" : ""}`);
      router.refresh();
      onClose();
    });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-in</DialogTitle>
          <DialogDescription>30 secondes : note les chiffres du jour. Laisse vide ce qui n&apos;a pas bougé.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label className="grid gap-1.5 text-[13px]">
            <span className="text-muted-foreground">Date</span>
            <Input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="grid max-h-[50vh] gap-2 overflow-y-auto">
            {metrics.map((item) => (
              <label key={item.id} className="flex items-center gap-3 text-[13px]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-foreground">{item.name}</span>
                  <span className="block text-[11.5px] text-subtle">
                    {item.latest ? `Dernière : ${formatChartValue(item.latest.value, item.unit)} (${longDate(item.latest.date)})` : "Aucune valeur"}
                    {item.aggregation === "sum" ? " · valeur du jour, additionnée" : ""}
                  </span>
                </span>
                <Input
                  inputMode="decimal"
                  className="w-28"
                  value={values[item.id] ?? ""}
                  placeholder={item.unit ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [item.id]: event.target.value }))}
                />
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MetricDialog({ projects, projectId, onClose }: { projects: ProjectOption[]; projectId?: string; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [project, setProject] = useState<string | null>(projectId ?? null);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [aggregation, setAggregation] = useState<"last" | "sum" | "avg">("last");
  const [pending, startTransition] = useTransition();
  const save = () =>
    startTransition(async () => {
      const result = await createMetric({ name, unit: unit || null, projectId: project, direction, aggregation });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Indicateur créé");
      router.refresh();
      onClose();
    });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvel indicateur</DialogTitle>
          <DialogDescription>Un chiffre que tu relèves régulièrement. Exemples : CA, marge, abonnés, ventes, vues.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3 text-[13px]"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label className="grid gap-1.5">
            <span className="text-muted-foreground">Nom</span>
            <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Chiffre d'affaires" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="text-muted-foreground">Unité</span>
              <Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="€, %, abonnés…" />
            </label>
            <div className="grid gap-1.5">
              <span className="text-muted-foreground">Projet</span>
              <ProjectPicker projects={projects} value={project} onChange={setProject} emptyLabel="Tous projets" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <span className="text-muted-foreground">Sens</span>
              <Select value={direction} onValueChange={(value) => setDirection(value as "up" | "down")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="up">Plus haut, c&apos;est mieux</SelectItem>
                  <SelectItem value="down">Plus bas, c&apos;est mieux</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <span className="text-muted-foreground">Sur une période</span>
              <Select value={aggregation} onValueChange={(value) => setAggregation(value as "last" | "sum" | "avg")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AGGREGATIONS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function periodRange(period: "month" | "quarter" | "year", today: string) {
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (period === "month") return { startsOn: `${y}-${pad(m)}-01`, endsOn: `${y}-${pad(m)}-${pad(last(y, m))}` };
  if (period === "quarter") {
    const q = Math.floor((m - 1) / 3) * 3 + 1;
    return { startsOn: `${y}-${pad(q)}-01`, endsOn: `${y}-${pad(q + 2)}-${pad(last(y, q + 2))}` };
  }
  return { startsOn: `${y}-01-01`, endsOn: `${y}-12-31` };
}

function GoalDialog({
  projects,
  metrics,
  today,
  projectId,
  onClose,
}: {
  projects: ProjectOption[];
  metrics: Metric[];
  today: string;
  projectId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState<"month" | "quarter" | "year" | "custom">("month");
  const [range, setRange] = useState(() => periodRange("month", today));
  const [kind, setKind] = useState<"metric" | "milestone">(metrics.length ? "metric" : "milestone");
  const [metricId, setMetricId] = useState<string>(metrics[0]?.id ?? "");
  const [target, setTarget] = useState("");
  const [project, setProject] = useState<string | null>(projectId ?? null);
  const [pending, startTransition] = useTransition();
  const chosen = metrics.find((m) => m.id === metricId);

  const save = () =>
    startTransition(async () => {
      const result = await createGoal({
        title,
        period,
        ...range,
        kind,
        metricId: kind === "metric" ? metricId : null,
        startValue: kind === "metric" && chosen?.aggregation !== "sum" ? (chosen?.latest?.value ?? null) : null,
        targetValue: kind === "metric" && target ? Number(target.replace(",", ".")) : null,
        projectId: project ?? chosen?.projectId ?? null,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Objectif créé");
      router.refresh();
      onClose();
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvel objectif</DialogTitle>
          <DialogDescription>Relié à un indicateur, sa progression se calcule toute seule.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3 text-[13px]"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label className="grid gap-1.5">
            <span className="text-muted-foreground">Objectif</span>
            <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="1 500 € de CA en novembre" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <span className="text-muted-foreground">Période</span>
              <Select
                value={period}
                onValueChange={(value) => {
                  const next = value as typeof period;
                  setPeriod(next);
                  if (next !== "custom") setRange(periodRange(next, today));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Ce mois</SelectItem>
                  <SelectItem value="quarter">Ce trimestre</SelectItem>
                  <SelectItem value="year">Cette année</SelectItem>
                  <SelectItem value="custom">Personnalisée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <span className="text-muted-foreground">Type</span>
              <Select value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric" disabled={metrics.length === 0}>
                    Chiffré (indicateur)
                  </SelectItem>
                  <SelectItem value="milestone">Jalon (fait / pas fait)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {period === "custom" ? (
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={range.startsOn} onChange={(event) => setRange({ ...range, startsOn: event.target.value })} aria-label="Début" />
              <Input type="date" value={range.endsOn} onChange={(event) => setRange({ ...range, endsOn: event.target.value })} aria-label="Fin" />
            </div>
          ) : null}
          {kind === "metric" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <span className="text-muted-foreground">Indicateur</span>
                <Select value={metricId} onValueChange={setMetricId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metrics.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                        {m.projectName ? ` · ${m.projectName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="grid gap-1.5">
                <span className="text-muted-foreground">Cible{chosen?.unit ? ` (${chosen.unit})` : ""}</span>
                <Input inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="1500" />
              </label>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <span className="text-muted-foreground">Projet</span>
              <ProjectPicker projects={projects} value={project} onChange={setProject} emptyLabel="Aucun projet" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MetricDetail({ metric, onClose }: { metric: Metric; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const archive = () =>
    startTransition(async () => {
      const result = await archiveMetric(metric.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Indicateur archivé");
      router.refresh();
      onClose();
    });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{metric.name}</DialogTitle>
          <DialogDescription>
            {metric.projectName ? `${metric.projectName} · ` : ""}
            {AGGREGATIONS[metric.aggregation]} · {metric.direction === "up" ? "plus haut, c'est mieux" : "plus bas, c'est mieux"}
          </DialogDescription>
        </DialogHeader>
        {metric.series.length ? (
          <>
            <LineChart points={metric.series} unit={metric.unit} label={`Évolution de ${metric.name}`} />
            <details className="text-[12.5px] text-muted-foreground">
              <summary className="cursor-pointer text-subtle">Voir les valeurs ({metric.series.length})</summary>
              <table className="mt-2 w-full tabular-nums">
                <tbody>
                  {[...metric.series].reverse().map((point) => (
                    <tr key={point.date} className="border-b border-border/60">
                      <td className="py-1">{longDate(point.date)}</td>
                      <td className="py-1 text-right text-foreground">{formatChartValue(point.value, metric.unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <CardEmpty>Aucune valeur pour l&apos;instant. Fais un check-in.</CardEmpty>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={archive} disabled={pending}>
            <ArchiveIcon /> Archiver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
