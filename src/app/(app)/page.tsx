import {
  ArrowUpRightIcon,
  FolderIcon,
  GoalIcon,
  InboxIcon,
  LightbulbIcon,
  ListTodoIcon,
  PhoneIcon,
  SparklesIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { NumberTicker } from "@/components/number-ticker";
import { PageContainer } from "@/components/page-header";
import { PhaseBadge } from "@/components/phase-badge";
import { ProjectIcon, projectColor } from "@/components/project-icon";
import { Reveal } from "@/components/reveal";
import { CardEmpty, SectionCard } from "@/components/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLongDate, formatRelative, greetingFor } from "@/lib/format";
import { PROJECT_STATUS_LABELS, PROJECT_TEMPLATES } from "@/lib/project-catalog";
import { PriorityList } from "@/components/tasks/priority-list";
import { endOfDayIn } from "@/lib/dates";
import { requireUser } from "@/server/dal";
import { toTaskView } from "@/server/data/task-views";
import { todayPriorities } from "@/server/data/tasks";
import { getRecentActivity, getTodayStats, listProjects } from "@/server/queries";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Aujourd'hui" };

export default function TodayPage() {
  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="ambient-glow -z-10" />
      <PageContainer>
        <Suspense fallback={<GreetingSkeleton />}>
          <Greeting />
        </Suspense>

        <Suspense fallback={<StatsSkeleton />}>
          <TodayStats />
        </Suspense>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Reveal index={1} className="lg:col-span-2">
            <SectionCard
              title="Priorités du jour"
              description="En retard, prévues aujourd'hui ou urgentes : trois au maximum."
              action={
                <Link href="/taches" className="inline-flex items-center gap-1 text-[12.5px] text-subtle transition-colors hover:text-foreground">
                  Toutes <ArrowUpRightIcon className="size-3" />
                </Link>
              }
              className="h-full"
            >
              <Suspense fallback={<ActivitySkeleton />}>
                <TodayPriorities />
              </Suspense>
            </SectionCard>
          </Reveal>

          <Reveal index={2}>
            <SectionCard
              title="Prochain appel"
              description="Avec son brief de préparation."
              action={<PhaseBadge phase={2} />}
              className="h-full"
            >
              <CardEmpty icon={<PhoneIcon />}>
                Avant chaque appel : ce qui a été dit la dernière fois, les actions promises et les
                questions à poser.
              </CardEmpty>
            </SectionCard>
          </Reveal>

          <Reveal index={3} className="lg:col-span-2">
            <SectionCard
              title="Objectifs du mois"
              description="Mesurables et reliés à tes KPI : la progression se calcule seule."
              action={<PhaseBadge phase={3} />}
              className="h-full"
            >
              <CardEmpty icon={<GoalIcon />}>
                Fixe 1 à 3 objectifs par projet (CA, marge, abonnés, publications…) et suis-les
                semaine après semaine.
              </CardEmpty>
            </SectionCard>
          </Reveal>

          <Reveal index={4}>
            <SectionCard title="Activité récente" className="h-full">
              <Suspense fallback={<ActivitySkeleton />}>
                <RecentActivity />
              </Suspense>
            </SectionCard>
          </Reveal>
        </div>

        <Suspense fallback={<ProjectsSkeleton />}>
          <ProjectsOverview />
        </Suspense>
      </PageContainer>
    </div>
  );
}

async function Greeting() {
  const me = await getCurrentUser();
  await connection();
  const now = new Date();
  const firstName = me.name.split(" ")[0] || me.name;

  return (
    <Reveal>
      <p className="text-[13px] font-medium text-subtle">{formatLongDate(now, me.timezone)}</p>
      <h1 className="mt-1.5 text-[28px] font-semibold tracking-[-0.025em] text-foreground sm:text-[32px]">
        {greetingFor(now, me.timezone)}, {firstName}.
      </h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        <SparklesIcon className="mr-1.5 inline size-3.5 -translate-y-px text-primary" />
        Ton brief du jour sera rédigé ici par l&apos;IA, à partir de tes priorités et de tes appels.
        <PhaseBadge phase={2} className="ml-2 align-middle" />
      </p>
    </Reveal>
  );
}

async function TodayPriorities() {
  const me = await requireUser();
  const tasks = await todayPriorities(endOfDayIn(me.timezone));
  if (tasks.length === 0) {
    return (
      <CardEmpty icon={<ListTodoIcon />}>
        Rien d&apos;urgent ni d&apos;en retard. Ajoute une échéance aux tâches qui comptent cette semaine, elles
        remonteront ici le jour venu.
      </CardEmpty>
    );
  }
  return <PriorityList tasks={tasks.map(toTaskView)} timeZone={me.timezone} />;
}

function GreetingSkeleton() {
  return (
    <div>
      <Skeleton className="h-3 w-32 rounded" />
      <Skeleton className="mt-3 h-8 w-64 rounded-lg" />
      <Skeleton className="mt-3 h-3.5 w-96 max-w-full rounded" />
    </div>
  );
}

async function TodayStats() {
  const stats = await getTodayStats();
  const tiles = [
    { label: "Projets actifs", value: stats.activeProjects, href: "/projets", icon: FolderIcon },
    { label: "Tâches ouvertes", value: stats.openTasks, href: "/taches", icon: ListTodoIcon },
    { label: "À trier dans l'Inbox", value: stats.inbox, href: "/inbox", icon: InboxIcon },
    { label: "Conseils à appliquer", value: stats.pendingAdvice, href: "/contacts", icon: LightbulbIcon },
  ];

  return (
    <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile, index) => (
        <Reveal key={tile.label} index={index}>
          <Link
            href={tile.href}
            className="surface group/tile flex flex-col gap-3 p-4 outline-none transition-[transform,border-color] duration-200 ease-out-expo hover:-translate-y-0.5 hover:border-white/12 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="flex items-center justify-between text-[12.5px] text-muted-foreground">
              {tile.label}
              <tile.icon className="size-3.5 text-subtle transition-colors group-hover/tile:text-muted-foreground" />
            </span>
            <NumberTicker
              value={tile.value}
              className="text-[26px] leading-none font-semibold tracking-tight text-foreground tabular-nums"
            />
          </Link>
        </Reveal>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="surface flex flex-col gap-4 p-4">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-6 w-10 rounded-md" />
        </div>
      ))}
    </div>
  );
}

async function RecentActivity() {
  const items = await getRecentActivity();
  const now = new Date();

  if (items.length === 0) {
    return <CardEmpty>Rien pour l&apos;instant.</CardEmpty>;
  }

  return (
    <ol className="relative flex flex-col gap-3.5 before:absolute before:top-1.5 before:bottom-1.5 before:left-[3.5px] before:w-px before:bg-white/[0.06]">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="relative flex gap-3 pl-0">
          <span
            aria-hidden
            className="relative mt-1.5 size-2 shrink-0 rounded-full ring-4 ring-surface"
            style={{ backgroundColor: item.color ? projectColor(item.color) : "var(--subtle)" }}
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] text-foreground/90">{item.title}</p>
            <p className="text-[12px] text-subtle">
              {item.detail ? `${item.detail} · ` : null}
              {formatRelative(item.at, now)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((key) => (
        <div key={key} className="flex gap-3">
          <Skeleton className="mt-1 size-2 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-4/5 rounded" />
            <Skeleton className="h-2.5 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function ProjectsOverview() {
  const projects = await listProjects();

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13.5px] font-medium text-foreground">Tes projets</h2>
        <Link
          href="/projets"
          className="inline-flex items-center gap-1 text-[12.5px] text-subtle transition-colors hover:text-foreground"
        >
          Tout voir <ArrowUpRightIcon className="size-3" />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, index) => (
          <Reveal key={project.id} index={index}>
            <Link
              href={`/projets/${project.slug}`}
              className="surface group/project flex h-full flex-col gap-4 p-4 outline-none transition-[transform,border-color] duration-200 ease-out-expo hover:-translate-y-0.5 hover:border-white/12 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <div className="flex items-start justify-between">
                <ProjectIcon icon={project.icon} color={project.color} size="md" />
                <span className="text-[11.5px] text-subtle">{PROJECT_STATUS_LABELS[project.status]}</span>
              </div>
              <div>
                <p className="text-[14px] font-medium text-foreground">{project.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  {project.description}
                </p>
              </div>
              <p className="mt-auto text-[11.5px] text-subtle">
                Template · {PROJECT_TEMPLATES[project.template].label}
              </p>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((key) => (
        <div key={key} className="surface flex h-36 flex-col gap-4 p-4">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-3.5 w-1/2 rounded" />
          <Skeleton className="h-3 w-4/5 rounded" />
        </div>
      ))}
    </div>
  );
}
