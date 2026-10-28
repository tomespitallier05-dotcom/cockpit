import { CalendarRangeIcon, ClipboardCheckIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { CardEmpty } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PERIOD_LABELS, periodTitle, type Period } from "@/lib/periods";
import { listReviews } from "@/server/data/reviews";
import { GenerateReviewMenu } from "./generate-menu";

export const metadata: Metadata = { title: "Bilans" };

export default function ReviewsPage() {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Bilans"
        description="Le rituel qui fait progresser : une revue hebdo guidée, et des bilans du mois à l'année, écrits à partir de tes chiffres."
        icon={<PageIcon icon={CalendarRangeIcon} />}
        actions={
          <>
            <GenerateReviewMenu />
            <Button asChild>
              <Link href="/bilans/hebdo">
                <ClipboardCheckIcon /> Revue de la semaine
              </Link>
            </Button>
          </>
        }
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
          <ReviewsList />
        </Suspense>
      </div>
    </PageContainer>
  );
}

async function ReviewsList() {
  const reviews = await listReviews();
  if (reviews.length === 0) {
    return (
      <CardEmpty>
        Aucun bilan pour l&apos;instant. Commence par la revue de la semaine : 10 minutes, pré-remplie avec tes tâches, tes KPI et les conseils en attente.
      </CardEmpty>
    );
  }
  return (
    <ul className="surface divide-y divide-border overflow-hidden">
      {reviews.map((item) => (
        <li key={item.id}>
          <Link href={`/bilans/${item.id}`} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-white/[0.025]">
            <span className="mt-0.5 w-20 shrink-0 text-[11.5px] tracking-wide text-subtle uppercase">{PERIOD_LABELS[item.period as Period]}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[13.5px] font-medium text-foreground first-letter:uppercase">
                {periodTitle(item.period as Period, item.periodStart)}
                {item.generatedBy === "ai" ? <SparklesIcon className="size-3.5 text-primary" aria-label="Rédigé par l'IA" /> : null}
              </span>
              {item.summary ? <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-muted-foreground">{item.summary}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
