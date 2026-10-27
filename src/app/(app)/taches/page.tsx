import { ListTodoIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { TaskBoard } from "@/components/tasks/task-board";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/dal";
import { listContactOptions } from "@/server/data/contacts";
import { toTaskView } from "@/server/data/task-views";
import { listTasks } from "@/server/data/tasks";
import { listProjects } from "@/server/queries";

export const metadata: Metadata = { title: "Tâches" };

export default function TasksPage({ searchParams }: PageProps<"/taches">) {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Tâches"
        description="Ce qui doit avancer, classé par échéance. Chaque tâche peut être reliée à un projet et promise à quelqu'un."
        icon={<PageIcon icon={ListTodoIcon} />}
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
          <TasksLoader searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}

async function TasksLoader({ searchParams }: { searchParams: PageProps<"/taches">["searchParams"] }) {
  const params = await searchParams;
  const [me, tasks, projects, contacts] = await Promise.all([
    requireUser(),
    listTasks(),
    listProjects(),
    listContactOptions(),
  ]);
  return (
    <TaskBoard
      tasks={tasks.map(toTaskView)}
      projects={projects.map(({ id, name, icon, color }) => ({ id, name, icon, color }))}
      contacts={contacts}
      timeZone={me.timezone}
      focusTaskId={typeof params.tache === "string" ? params.tache : undefined}
      autoFocusNew={params.nouvelle === "1"}
    />
  );
}
