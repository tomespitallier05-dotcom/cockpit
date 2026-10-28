import { ArrowLeftIcon, ClipboardCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dayKey } from "@/lib/dates";
import { periodRange, periodTitle } from "@/lib/periods";
import { collectPeriod } from "@/server/ai/reviews";
import { requireUser } from "@/server/dal";
import { listInsights } from "@/server/data/insights";
import { listTasks } from "@/server/data/tasks";
import { WeeklyReview } from "./weekly-review";

export const metadata: Metadata = { title: "Revue de la semaine" };

export default function WeeklyReviewPage() {
  return (
    <PageContainer className="max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground">
        <Link href="/bilans">
          <ArrowLeftIcon /> Bilans
        </Link>
      </Button>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <WeeklyLoader />
      </Suspense>
    </PageContainer>
  );
}

async function WeeklyLoader() {
  const me = await requireUser();
  const today = dayKey(new Date(), me.timezone);
  // Early in the week, the review is about the week that just ended.
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const range = periodRange("week", today, weekday <= 1 ? -1 : 0);
  const [data, tasks, advice] = await Promise.all([
    collectPeriod(me.workspaceId, me.timezone, range.start, range.end),
    listTasks(),
    listInsights({ type: "advice", status: "accepted", limit: 30 }),
  ]);
  const open = tasks.filter((t) => t.status === "todo" || t.status === "in_progress").slice(0, 30);

  return (
    <>
      <PageHeader
        title="Revue de la semaine"
        description={`${periodTitle("week", range.start)} · 10 minutes pour regarder les chiffres, faire le point sur les conseils et choisir 3 priorités.`}
        icon={<PageIcon icon={ClipboardCheckIcon} />}
      />
      <WeeklyReview
        start={range.start}
        timeZone={me.timezone}
        data={{
          tasksDone: data.tasksDone,
          overdue: data.overdue,
          kpis: data.kpis,
          adviceApplied: data.adviceApplied,
          resale: data.resale,
          content: data.content,
          mistakes: data.insights.mistakes,
        }}
        advice={advice}
        openTasks={open.map((t) => ({ id: t.id, title: t.title, projectName: t.projectName ?? null, dueAt: t.dueAt }))}
      />
    </>
  );
}
