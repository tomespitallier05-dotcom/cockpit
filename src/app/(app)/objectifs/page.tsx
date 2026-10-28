import { GoalIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { GoalsView } from "@/components/goals/goals-view";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { dayKey } from "@/lib/dates";
import { requireUser } from "@/server/dal";
import { listGoals, listMetrics } from "@/server/data/goals";
import { listProjects } from "@/server/queries";

export const metadata: Metadata = { title: "Objectifs & KPI" };

export default function GoalsPage() {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        title="Objectifs & KPI"
        description="Des objectifs mesurables, reliés à tes indicateurs. La progression se calcule, elle ne se déclare pas."
        icon={<PageIcon icon={GoalIcon} />}
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
          <GoalsLoader />
        </Suspense>
      </div>
    </PageContainer>
  );
}

async function GoalsLoader() {
  const [me, goals, metrics, projects] = await Promise.all([requireUser(), listGoals(), listMetrics(), listProjects()]);
  return (
    <GoalsView
      goals={goals}
      metrics={metrics}
      projects={projects.map(({ id, name, icon, color }) => ({ id, name, icon, color }))}
      today={dayKey(new Date(), me.timezone)}
    />
  );
}
