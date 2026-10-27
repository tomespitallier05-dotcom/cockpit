import {
  BookOpenIcon,
  FileStackIcon,
  GoalIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  ListTodoIcon,
  PackageIcon,
  UsersIcon,
  WorkflowIcon,
  ScaleIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-header";
import { ProjectIcon } from "@/components/project-icon";
import { Reveal } from "@/components/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate } from "@/lib/format";
import { PROJECT_STATUS_LABELS, PROJECT_TEMPLATES, type ProjectTemplate } from "@/lib/project-catalog";
import { getProjectBySlug } from "@/server/queries";
import { getCurrentUser } from "@/server/session";
import { ProjectTabs, type ProjectTab } from "./project-tabs";

export const metadata: Metadata = { title: "Projet" };

export default function ProjectPage({ params }: PageProps<"/projets/[slug]">) {
  return (
    <PageContainer>
      <Suspense fallback={<ProjectSkeleton />}>
        <ProjectView params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function ProjectView({ params }: { params: PageProps<"/projets/[slug]">["params"] }) {
  const { slug } = await params;
  const [project, me] = await Promise.all([getProjectBySlug(slug), getCurrentUser()]);
  if (!project) notFound();

  const template = PROJECT_TEMPLATES[project.template];

  return (
    <>
      <Reveal>
        <header className="flex items-start gap-4">
          <ProjectIcon icon={project.icon} color={project.color} size="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">{project.name}</h1>
            {project.description ? (
              <p className="mt-1 text-[13.5px] text-muted-foreground">{project.description}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-subtle">
              <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                {PROJECT_STATUS_LABELS[project.status]}
              </span>
              <span>Template {template.label}</span>
              <span aria-hidden>·</span>
              <span>Démarré le {formatShortDate(project.startedAt, me.timezone)}</span>
            </div>
          </div>
        </header>
      </Reveal>
      <ProjectTabs tabs={tabsFor(project.template)} />
    </>
  );
}

function tabsFor(templateKey: ProjectTemplate): ProjectTab[] {
  const template = PROJECT_TEMPLATES[templateKey];
  const tabs: ProjectTab[] = [
    {
      key: "overview",
      label: "Vue d'ensemble",
      content: (
        <EmptyState
          icon={LayoutDashboardIcon}
          title="Le tableau de bord du projet"
          description="Ses chiffres, ses objectifs et ce qui s'y passe, sur un seul écran."
          phase={1}
          features={["KPI du projet", "Objectifs en cours", "Dernières entrées et appels", "Conseils à appliquer"]}
        />
      ),
    },
    {
      key: "timeline",
      label: "Timeline",
      content: (
        <EmptyState
          icon={HistoryIcon}
          title="Tout ce qui s'est passé, dans l'ordre"
          description="Les entrées sont classées par date réelle de l'événement, pas par date de saisie."
          phase={1}
          features={[
            "Notes, appels, messages, fichiers et liens",
            "Filtres par type et par contact",
            "Liens [[note]] et mentions @contact",
            "Entrées épinglées en tête",
          ]}
        />
      ),
    },
    {
      key: "knowledge",
      label: "Connaissances",
      content: (
        <EmptyState
          icon={LightbulbIcon}
          title="Ce que ce projet t'a appris"
          description="Conseils, décisions, erreurs et leçons, extraits de tes entrées par l'IA, chacun relié à sa source."
          phase={2}
          features={[
            "Conseils : nouveau, testé, appliqué",
            "Erreurs répétées détectées",
            "Citation et lien vers la source",
            "Recherche par le sens",
          ]}
        />
      ),
    },
    {
      key: "tasks",
      label: "Tâches",
      content: (
        <EmptyState
          icon={ListTodoIcon}
          title="Les tâches du projet"
          description="Avec leur origine : l'appel ou la note dont elles viennent."
          phase={1}
        />
      ),
    },
    {
      key: "goals",
      label: "Objectifs & KPI",
      content: (
        <EmptyState
          icon={GoalIcon}
          title="Indicateurs et objectifs"
          description="3 à 5 KPI par projet, mis à jour chaque semaine en 30 secondes."
          phase={3}
        />
      ),
    },
  ];

  if (template.module) {
    tabs.push({ key: template.module.key, label: template.module.label, content: moduleContent(templateKey) });
  }

  tabs.push(
    {
      key: "files",
      label: "Fichiers",
      content: (
        <EmptyState
          icon={FileStackIcon}
          title="Médias et documents"
          description="Photos, captures, PDF, tableurs, audio et vidéo, tous rendus cherchables."
          phase={1}
          features={[
            "Stockage privé, liens signés",
            "Texte extrait des PDF et images (phase 2)",
            "Appels enregistrés et transcrits (phase 2)",
            "Liens et documents externes",
          ]}
        />
      ),
    },
    {
      key: "contacts",
      label: "Contacts",
      content: (
        <EmptyState
          icon={UsersIcon}
          title="Les personnes du projet"
          description="Mentor, clients, fournisseurs : qui t'accompagne sur ce projet."
          phase={1}
        />
      ),
    },
  );

  return tabs;
}

function moduleContent(templateKey: ProjectTemplate) {
  switch (templateKey) {
    case "resale":
      return (
        <EmptyState
          icon={PackageIcon}
          title="Inventaire et marges"
          description="Chaque article avec son économie complète : c'est ce qui permettra de savoir quels produits sont prometteurs."
          phase={3}
          features={[
            "Prix d'achat, de vente, frais et plateforme",
            "Marge, ROI et délai de vente par article",
            "Catégories et marques qui rapportent le plus",
            "Stock dormant signalé",
          ]}
        />
      );
    case "content":
      return (
        <EmptyState
          icon={WorkflowIcon}
          title="Pipeline de contenu"
          description="De l'idée à la publication, puis ses statistiques."
          phase={3}
          features={[
            "Idée → script → tournage → montage → publié",
            "Banque de hooks et d'inspirations",
            "Statistiques par publication",
            "Calendrier éditorial",
          ]}
        />
      );
    case "business":
      return (
        <EmptyState
          icon={ScaleIcon}
          title="Registre de décisions"
          description="Ce que tu as décidé, pourquoi, et ce que ça a donné."
          phase={3}
          features={[
            "Décision, raisons, alternatives écartées",
            "Date de réévaluation rappelée",
            "Résultat constaté après coup",
            "Journal d'expériences : hypothèse → résultat",
          ]}
        />
      );
    default:
      return (
        <EmptyState icon={BookOpenIcon} title="Module" description="Ce template n'a pas de module dédié." />
      );
  }
}

function ProjectSkeleton() {
  return (
    <div>
      <div className="flex items-start gap-4">
        <Skeleton className="size-11 rounded-xl" />
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-3.5 w-72 rounded" />
          <Skeleton className="h-3 w-56 rounded" />
        </div>
      </div>
      <Skeleton className="mt-10 h-8 w-full rounded-lg" />
      <Skeleton className="mt-6 h-72 w-full rounded-2xl" />
    </div>
  );
}
