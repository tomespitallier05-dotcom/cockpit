import { LightbulbIcon, RepeatIcon, TimerIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cn } from "cn";
import { InsightList } from "@/components/insights/insight-list";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { CardEmpty, SectionCard } from "@/components/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { INSIGHT_TYPE_META, type InsightTypeKey } from "@/lib/insight-catalog";
import { requireUser } from "@/server/dal";
import { adviceStats, listInsights, repeatedMistakes, stalledAdvice } from "@/server/data/insights";

export const metadata: Metadata = { title: "Connaissances" };

const VIEWS = [
  { key: "a-revoir", label: "À revoir" },
  { key: "advice", label: "Conseils" },
  { key: "decision", label: "Décisions" },
  { key: "action", label: "Actions" },
  { key: "mistake", label: "Erreurs" },
  { key: "lesson", label: "Leçons" },
  { key: "idea", label: "Idées" },
  { key: "key_fact", label: "Chiffres clés" },
  { key: "tout", label: "Tout" },
] as const;

export default function InsightsPage({ searchParams }: PageProps<"/insights">) {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        title="Connaissances"
        description="Les conseils, décisions, erreurs et leçons extraits de tes appels et de tes notes. Chacun garde sa source."
        icon={<PageIcon icon={LightbulbIcon} />}
      />
      <Suspense fallback={<Skeleton className="mt-8 h-96 w-full rounded-2xl" />}>
        <InsightsLoader searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function InsightsLoader({ searchParams }: { searchParams: PageProps<"/insights">["searchParams"] }) {
  const params = await searchParams;
  const view = VIEWS.find((v) => v.key === params.vue)?.key ?? "a-revoir";
  const type = view in INSIGHT_TYPE_META ? (view as InsightTypeKey) : undefined;
  const [me, items, stats, stalled, repeated] = await Promise.all([
    requireUser(),
    listInsights(view === "a-revoir" ? { status: "proposed" } : { type }),
    adviceStats(),
    stalledAdvice(),
    repeatedMistakes(),
  ]);

  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Conseils appliqués"
          value={stats.rate === null ? "—" : `${Math.round(stats.rate * 100)} %`}
          hint={`${stats.applied} sur ${stats.applied + stats.accepted} retenus, 90 derniers jours`}
          accent
        />
        <Stat label="À appliquer" value={String(stats.accepted)} hint="Conseils retenus, pas encore appliqués" />
        <Stat label="Propositions à revoir" value={String(stats.proposed)} hint="Extraites par l'IA, en attente de ton avis" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <nav className="-mx-1 flex flex-wrap gap-1" aria-label="Filtrer">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                href={v.key === "a-revoir" ? "/insights" : `/insights?vue=${v.key}`}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[12.5px] transition-colors",
                  v.key === view ? "bg-white/[0.07] text-foreground" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                {v.label}
              </Link>
            ))}
          </nav>
          <div className="surface mt-3 px-5 py-2">
            <InsightList
              insights={items}
              timeZone={me.timezone}
              empty={
                <div className="py-6">
                  <CardEmpty>
                    {view === "a-revoir"
                      ? "Aucune proposition en attente. Les nouvelles arrivent après chaque appel, note ou fichier analysé."
                      : "Rien ici pour l'instant."}
                  </CardEmpty>
                </div>
              }
            />
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <SectionCard title={<span className="flex items-center gap-2"><TimerIcon className="size-4 text-subtle" />Conseils qui attendent</span>} description="Retenus depuis plus de 14 jours, toujours pas appliqués.">
            <InsightList
              insights={stalled}
              timeZone={me.timezone}
              empty={<CardEmpty>Aucun conseil en souffrance.</CardEmpty>}
            />
          </SectionCard>
          <SectionCard title={<span className="flex items-center gap-2"><RepeatIcon className="size-4 text-subtle" />Erreurs qui reviennent</span>} description="Regroupées par sens, pas par mots.">
            {repeated.length ? (
              <ul className="space-y-4">
                {repeated.slice(0, 5).map((group) => (
                  <li key={group[0].id}>
                    <p className="text-[13px] font-medium text-foreground">
                      {group[0].content} <span className="text-subtle">×{group.length}</span>
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {group.map((item) => (
                        <li key={item.id}>
                          <Link href={`/entrees/${item.sourceEntryId}`} className="text-[12px] text-subtle hover:text-foreground">
                            {item.sourceTitle || "Sans titre"} · {item.sourceDate.toLocaleDateString("fr-FR", { timeZone: me.timezone })}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <CardEmpty>Pas d&apos;erreur répétée repérée. Elles apparaissent ici dès qu&apos;une même erreur revient.</CardEmpty>
            )}
          </SectionCard>
        </aside>
      </div>
    </>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className="surface px-4 py-3.5">
      <p className="text-[12px] text-subtle">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight", accent ? "text-primary" : "text-foreground")}>
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-subtle">{hint}</p>
    </div>
  );
}
