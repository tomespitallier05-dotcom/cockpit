import { FolderIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { PhaseBadge } from "@/components/phase-badge";
import { ProjectIcon } from "@/components/project-icon";
import { Reveal } from "@/components/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { PROJECT_STATUS_LABELS, PROJECT_TEMPLATES } from "@/lib/project-catalog";
import { listProjects } from "@/server/queries";

export const metadata: Metadata = { title: "Projets" };

export default function ProjectsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Projets"
        description="Chaque projet est un espace autonome, organisé par son template."
        icon={<PageIcon icon={FolderIcon} />}
      />
      <Suspense fallback={<ProjectGridSkeleton />}>
        <ProjectGrid />
      </Suspense>
    </PageContainer>
  );
}

async function ProjectGrid() {
  const projects = await listProjects();

  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project, index) => {
        const template = PROJECT_TEMPLATES[project.template];
        return (
          <Reveal key={project.id} index={index}>
            <Link
              href={`/projets/${project.slug}`}
              className="surface flex h-full flex-col gap-4 p-5 outline-none transition-[transform,border-color] duration-200 ease-out-expo hover:-translate-y-0.5 hover:border-white/12 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <div className="flex items-start justify-between">
                <ProjectIcon icon={project.icon} color={project.color} size="lg" />
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {PROJECT_STATUS_LABELS[project.status]}
                </span>
              </div>
              <div>
                <p className="text-[15px] font-medium text-foreground">{project.name}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{project.description}</p>
              </div>
              <p className="mt-auto text-[12px] text-subtle">{template.description}</p>
            </Link>
          </Reveal>
        );
      })}
      <Reveal index={projects.length}>
        <div className="flex h-full min-h-44 flex-col items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-dashed border-white/10 p-5 text-center">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/[0.04] text-subtle">
            <PlusIcon className="size-4" />
          </span>
          <p className="text-[13.5px] font-medium text-muted-foreground">Nouveau projet</p>
          <p className="text-[12px] text-subtle">Nom, icône, couleur et template, en un instant.</p>
          <PhaseBadge phase={1} className="mt-1" />
        </div>
      </Reveal>
    </div>
  );
}

function ProjectGridSkeleton() {
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((key) => (
        <div key={key} className="surface flex h-48 flex-col gap-4 p-5">
          <Skeleton className="size-11 rounded-xl" />
          <Skeleton className="h-4 w-1/2 rounded" />
          <Skeleton className="h-3 w-4/5 rounded" />
        </div>
      ))}
    </div>
  );
}
