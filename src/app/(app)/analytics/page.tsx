import { ChartNoAxesColumnIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BarChart, LineChart } from "@/components/charts";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { CardEmpty, SectionCard } from "@/components/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { PROJECT_COLORS, type ProjectColor } from "@/lib/project-catalog";
import { getAnalytics } from "@/server/data/analytics";
import { listMetrics } from "@/server/data/goals";
import { adviceStats } from "@/server/data/insights";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description="Tes résultats et ton activité, semaine après semaine. Des résultats d'abord, de l'activité ensuite."
        icon={<PageIcon icon={ChartNoAxesColumnIcon} />}
      />
      <Suspense fallback={<Skeleton className="mt-8 h-[70vh] w-full rounded-2xl" />}>
        <AnalyticsLoader />
      </Suspense>
    </PageContainer>
  );
}

function hours(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

async function AnalyticsLoader() {
  const [data, metrics, advice] = await Promise.all([getAnalytics(), listMetrics({ historyDays: 180 }), adviceStats()]);
  const plotted = metrics.filter((m) => m.series.length >= 2);
  const maxMinutes = Math.max(1, ...data.timeByProject.map((row) => row.minutes));

  return (
    <div className="mt-8 flex flex-col gap-6">
      <section className="surface grid grid-cols-1 gap-6 p-5 md:grid-cols-[260px_minmax(0,1fr)]">
        <div>
          <p className="text-[12.5px] text-subtle">Conseils appliqués</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight text-foreground">
            {advice.rate === null ? "—" : `${Math.round(advice.rate * 100)} %`}
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            L&apos;indicateur qui compte : la part des conseils retenus que tu as vraiment mis en pratique (90 derniers jours).
          </p>
        </div>
        <div>
          <p className="mb-2 text-[12px] text-subtle">Par mois, en % des conseils retenus</p>
          <BarChart bars={data.adviceByMonth} unit="%" label="Conseils appliqués par mois" />
        </div>
      </section>

      {plotted.length ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {plotted.map((m) => (
            <SectionCard key={m.id} title={m.name} description={m.projectName ?? "Tous projets"}>
              <LineChart points={m.series} unit={m.unit} label={`Évolution de ${m.name}`} />
            </SectionCard>
          ))}
        </div>
      ) : (
        <CardEmpty>Les courbes de tes KPI apparaissent ici dès deux check-ins. Commence dans Objectifs & KPI.</CardEmpty>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.profitByMonth ? (
          <SectionCard title="Bénéfice de la revente" description="Par mois, frais déduits">
            <BarChart bars={data.profitByMonth} unit="€" label="Bénéfice de la revente par mois" />
          </SectionCard>
        ) : null}
        {data.viewsByMonth ? (
          <SectionCard title="Vues des publications" description="Par mois de publication">
            <BarChart bars={data.viewsByMonth} label="Vues par mois" />
          </SectionCard>
        ) : null}
        <SectionCard title="Objectifs de l'année" description="Atteints, manqués, en cours">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Atteints", data.goals.achieved],
              ["Manqués", data.goals.missed],
              ["En cours", data.goals.active],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/[0.025] px-3 py-3">
                <p className="text-[11.5px] text-subtle">{label}</p>
                <p className="mt-0.5 text-xl font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Tâches terminées" description="12 dernières semaines">
          <BarChart bars={data.tasksPerWeek} label="Tâches terminées par semaine" />
        </SectionCard>
        <SectionCard title="Temps investi par projet" description="30 derniers jours : temps passé sur les tâches et durée des appels">
          {data.timeByProject.length ? (
            <ul className="space-y-3">
              {data.timeByProject.map((row) => (
                <li key={row.name} className="text-[13px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-foreground">{row.name}</span>
                    <span className="tabular-nums text-muted-foreground">{hours(row.minutes)}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-white/[0.04]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(row.minutes / maxMinutes) * 100}%`, background: PROJECT_COLORS[row.color as ProjectColor] ?? PROJECT_COLORS.slate }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <CardEmpty>Renseigne le temps réel des tâches et la durée des appels pour voir où passe ton temps.</CardEmpty>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
