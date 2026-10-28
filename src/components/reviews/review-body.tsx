import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { cn } from "cn";
import type { KpiSnapshot, ReviewContent } from "@/server/data/reviews";

function num(value: number | null, unit: string | null) {
  if (value === null) return "—";
  const text = value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return unit ? `${text} ${unit}` : text;
}

const ANSWER_LABELS: Record<string, string> = {
  proud: "Ce dont je suis fier",
  blocked: "Ce qui a bloqué",
  learned: "Ce que je retiens",
  next: "Pour la suite",
};

/** The readable body of a review, shared by the owner's page and the mentor's link. */
export function ReviewBody({ content, snapshot }: { content: ReviewContent; snapshot: KpiSnapshot[] }) {
  const n = content.narrative;
  const stats = content.stats;
  return (
    <div className="flex flex-col gap-6">
      {stats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Tâches terminées" value={String(stats.tasksDone)} />
          <Tile label="Conseils appliqués" value={String(stats.adviceApplied)} />
          {stats.soldCount ? <Tile label="Bénéfice revente" value={`${(stats.profitCents / 100).toLocaleString("fr-FR")} €`} hint={`${stats.soldCount} vente(s)`} /> : null}
          {stats.published ? <Tile label="Contenus publiés" value={String(stats.published)} hint={stats.views ? `${stats.views.toLocaleString("fr-FR")} vues` : undefined} /> : null}
        </div>
      ) : null}

      {snapshot.some((k) => k.end !== null) ? (
        <section className="surface overflow-x-auto p-5">
          <h2 className="text-[13.5px] font-medium text-foreground">Indicateurs</h2>
          <table className="mt-3 w-full min-w-[420px] text-[13px] tabular-nums">
            <thead>
              <tr className="text-left text-[11.5px] text-subtle">
                <th className="py-1.5 font-normal">Indicateur</th>
                <th className="py-1.5 text-right font-normal">Début</th>
                <th className="py-1.5 text-right font-normal">Fin</th>
                <th className="py-1.5 text-right font-normal">Tendance</th>
              </tr>
            </thead>
            <tbody>
              {snapshot
                .filter((k) => k.end !== null)
                .map((k) => {
                  const diff = k.start !== null && k.end !== null ? k.end - k.start : null;
                  const good = diff === null || diff === 0 ? null : k.direction === "up" ? diff > 0 : diff < 0;
                  const Icon = diff === null || diff === 0 ? MinusIcon : diff > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
                  return (
                    <tr key={`${k.name}-${k.projectName}`} className="border-t border-border/60">
                      <td className="py-2 text-foreground">
                        {k.name}
                        {k.projectName ? <span className="text-subtle"> · {k.projectName}</span> : null}
                        {k.aggregation === "sum" ? <span className="text-subtle"> (total)</span> : null}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">{num(k.start, k.unit)}</td>
                      <td className="py-2 text-right text-foreground">{num(k.end, k.unit)}</td>
                      <td className={cn("py-2 text-right", good === null ? "text-subtle" : good ? "text-success" : "text-destructive")}>
                        <Icon className="ml-auto size-4" aria-label={good === null ? "stable" : good ? "en progrès" : "en recul"} />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      ) : null}

      {n ? (
        <section className="surface p-5">
          <p className="text-[14px] leading-relaxed text-foreground">{n.summary}</p>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <List title="Résultats" items={n.wins} />
            <List title="Ce qui a bloqué" items={n.blockers} />
            <List title="À retenir" items={n.lessons} />
            <List title="Priorités pour la suite" items={n.nextFocus} ordered />
          </div>
          {n.adviceFollowUp ? (
            <p className="mt-5 border-t border-border pt-4 text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">Conseils : </span>
              {n.adviceFollowUp}
            </p>
          ) : null}
          {n.question ? <p className="mt-3 text-[13px] italic text-muted-foreground">{n.question}</p> : null}
        </section>
      ) : null}

      {content.answers && Object.keys(content.answers).length ? (
        <section className="surface p-5">
          <h2 className="text-[13.5px] font-medium text-foreground">Réponses de la revue</h2>
          <dl className="mt-3 grid gap-4">
            {Object.entries(content.answers).map(([key, value]) => (
              <div key={key}>
                <dt className="text-[12px] text-subtle">{ANSWER_LABELS[key] ?? key}</dt>
                <dd className="mt-0.5 whitespace-pre-line text-[13.5px] text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface px-4 py-3.5">
      <p className="text-[12px] text-subtle">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[11.5px] text-subtle">{hint}</p> : null}
    </div>
  );
}

function List({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  if (!items?.length) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <div>
      <h3 className="text-[12px] font-medium tracking-wide text-subtle uppercase">{title}</h3>
      <Tag className={cn("mt-2 space-y-1 pl-4 text-[13px] text-muted-foreground", ordered ? "list-decimal" : "list-disc marker:text-subtle")}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </Tag>
    </div>
  );
}
