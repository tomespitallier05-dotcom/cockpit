import {
  BookOpenIcon,
  FileIcon,
  FileTextIcon,
  GoalIcon,
  HistoryIcon,
  ImageIcon,
  LightbulbIcon,
  PackageIcon,
  PlusIcon,
  ScaleIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaptureButton } from "@/components/capture/capture-button";
import { EmptyState } from "@/components/empty-state";
import { EntryTimeline } from "@/components/entries/entry-timeline";
import { PageContainer } from "@/components/page-header";
import { ProjectIcon } from "@/components/project-icon";
import { Reveal } from "@/components/reveal";
import { CardEmpty, SectionCard } from "@/components/section-card";
import { initials } from "@/lib/format";
import { TaskBoard } from "@/components/tasks/task-board";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, formatShortDate } from "@/lib/format";
import { shortDayLabel } from "@/lib/dates";
import { CONTACT_RELATIONSHIPS, type ContactRelationship } from "@/lib/entry-catalog";
import { PROJECT_STATUS_LABELS, PROJECT_TEMPLATES, type ProjectTemplate } from "@/lib/project-catalog";
import { requireUser } from "@/server/dal";
import { listContactOptions, listProjectContacts } from "@/server/data/contacts";
import { listEntries, listProjectFiles } from "@/server/data/entries";
import { toTaskView } from "@/server/data/task-views";
import { listTasks } from "@/server/data/tasks";
import { getProjectBySlug, listProjects } from "@/server/queries";
import { EditProjectButton } from "@/components/projects/project-buttons";
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
  const [project, me] = await Promise.all([getProjectBySlug(slug), requireUser()]);
  if (!project) notFound();

  const [entries, tasks, contacts, files, projects, contactOptions] = await Promise.all([
    listEntries({ projectId: project.id }),
    listTasks({ projectId: project.id }),
    listProjectContacts(project.id),
    listProjectFiles(project.id),
    listProjects(),
    listContactOptions(),
  ]);

  const template = PROJECT_TEMPLATES[project.template];
  const projectOptions = projects.map(({ id, name, icon, color }) => ({ id, name, icon, color }));
  const taskViews = tasks.map(toTaskView);
  const openTasks = taskViews.filter((item) => item.status === "todo" || item.status === "in_progress");

  const tabs: ProjectTab[] = [
    {
      key: "overview",
      label: "Vue d'ensemble",
      content: (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-3 lg:col-span-3 lg:grid-cols-4">
            {[
              { label: "Entrées", value: entries.length },
              { label: "Tâches ouvertes", value: openTasks.length },
              { label: "Contacts", value: contacts.length },
              { label: "Fichiers", value: files.length },
            ].map((tile) => (
              <div key={tile.label} className="surface p-4">
                <p className="text-[12.5px] text-muted-foreground">{tile.label}</p>
                <p className="mt-2 text-[24px] leading-none font-semibold tracking-tight text-foreground tabular-nums">{tile.value}</p>
              </div>
            ))}
          </div>
          <SectionCard title="Dernières entrées" className="lg:col-span-2">
            {entries.length ? (
              <EntryTimeline entries={entries.slice(0, 5)} timeZone={me.timezone} showProject={false} />
            ) : (
              <CardEmpty>Rien pour l&apos;instant. Capture le premier appel, la première note ou le premier conseil de ce projet.</CardEmpty>
            )}
          </SectionCard>
          <div className="flex flex-col gap-4">
            <SectionCard title="Prochaines tâches">
              {openTasks.length ? (
                <ul className="flex flex-col gap-2">
                  {openTasks.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <Link href={`/taches?tache=${item.id}`} className="flex items-center justify-between gap-2 text-[13px] text-foreground hover:underline">
                        <span className="truncate">{item.title}</span>
                        {item.dueAt ? <span className="shrink-0 text-[11.5px] text-subtle">{shortDayLabel(item.dueAt, me.timezone)}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <CardEmpty>Aucune tâche ouverte.</CardEmpty>
              )}
            </SectionCard>
            <SectionCard title="Personnes">
              <ContactList contacts={contacts} />
            </SectionCard>
          </div>
        </div>
      ),
    },
    {
      key: "timeline",
      label: "Timeline",
      content: entries.length ? (
        <EntryTimeline entries={entries} timeZone={me.timezone} showProject={false} />
      ) : (
        <EmptyState
          icon={HistoryIcon}
          title="La timeline du projet est vide"
          description="Notes, appels, messages, liens et fichiers apparaîtront ici, classés par date réelle de l'événement."
          action={
            <CaptureButton projectId={project.id}>
              <PlusIcon /> Nouvelle entrée
            </CaptureButton>
          }
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
          description="Conseils, décisions, erreurs et leçons extraits de tes entrées par l'IA, chacun relié à sa source."
          phase={2}
          features={["Conseils : nouveau, testé, appliqué", "Erreurs répétées détectées", "Citation et lien vers la source", "Recherche par le sens"]}
        />
      ),
    },
    {
      key: "tasks",
      label: "Tâches",
      content: (
        <TaskBoard
          tasks={taskViews}
          projects={projectOptions}
          contacts={contactOptions}
          timeZone={me.timezone}
          defaultProjectId={project.id}
          showProject={false}
        />
      ),
    },
    {
      key: "goals",
      label: "Objectifs & KPI",
      content: (
        <EmptyState icon={GoalIcon} title="Indicateurs et objectifs" description="3 à 5 KPI par projet, mis à jour chaque semaine en 30 secondes." phase={3} />
      ),
    },
  ];

  if (template.module) {
    tabs.push({ key: template.module.key, label: template.module.label, content: moduleContent(project.template) });
  }

  tabs.push(
    {
      key: "files",
      label: "Fichiers",
      content: files.length ? (
        <ul className="surface divide-y divide-border overflow-hidden">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-4 py-3 text-[13px] [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-subtle">
              {file.kind === "image" ? <ImageIcon /> : file.kind === "pdf" || file.kind === "document" ? <FileTextIcon /> : <FileIcon />}
              <a href={`/api/fichiers/${file.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-foreground hover:underline">
                {file.fileName}
              </a>
              <Link href={`/entrees/${file.entryId}`} className="hidden max-w-48 truncate text-subtle hover:text-foreground sm:block">
                {file.entryTitle ?? "Entrée"}
              </Link>
              <span className="shrink-0 text-subtle">{formatBytes(file.sizeBytes)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={FileIcon}
          title="Aucun fichier"
          description="Joins photos, captures, PDF ou tableurs à une entrée du projet : ils se retrouvent tous ici."
        />
      ),
    },
    {
      key: "contacts",
      label: "Contacts",
      content: (
        <div className="surface p-5">
          <ContactList contacts={contacts} />
          <p className="mt-4 text-[12.5px] text-subtle">
            Relie une personne à ce projet depuis sa fiche dans{" "}
            <Link href="/contacts" className="text-foreground underline-offset-2 hover:underline">
              Contacts
            </Link>
            .
          </p>
        </div>
      ),
    },
  );

  return (
    <>
      <Reveal>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <ProjectIcon icon={project.icon} color={project.color} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">{project.name}</h1>
            {project.description ? <p className="mt-1 text-[13.5px] text-muted-foreground">{project.description}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-subtle">
              <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">{PROJECT_STATUS_LABELS[project.status]}</span>
              <span>Template {template.label}</span>
              <span aria-hidden>·</span>
              <span>Démarré le {formatShortDate(project.startedAt, me.timezone)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <EditProjectButton
              project={{
                id: project.id,
                name: project.name,
                description: project.description,
                icon: project.icon,
                color: project.color,
                template: project.template,
                status: project.status,
              }}
            />
            <CaptureButton projectId={project.id}>
              <PlusIcon /> Nouvelle entrée
            </CaptureButton>
          </div>
        </header>
      </Reveal>
      <ProjectTabs tabs={tabs} />
    </>
  );
}

function ContactList({ contacts }: { contacts: { id: string; name: string; role: string | null; relationship: string }[] }) {
  if (contacts.length === 0) return <CardEmpty icon={<UsersIcon />}>Personne n&apos;est encore relié à ce projet.</CardEmpty>;
  return (
    <ul className="flex flex-col gap-3">
      {contacts.map((contact) => (
        <li key={contact.id}>
          <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3 rounded-lg outline-none hover:opacity-90">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#2a2f3d,#1b1e27)] text-[11px] font-semibold text-foreground/85">
              {initials(contact.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-foreground">{contact.name}</span>
              <span className="block truncate text-[12px] text-subtle">
                {contact.role || CONTACT_RELATIONSHIPS[contact.relationship as ContactRelationship]}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
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
          features={["Prix d'achat, de vente, frais et plateforme", "Marge, ROI et délai de vente par article", "Catégories et marques qui rapportent le plus", "Stock dormant signalé"]}
        />
      );
    case "content":
      return (
        <EmptyState
          icon={WorkflowIcon}
          title="Pipeline de contenu"
          description="De l'idée à la publication, puis ses statistiques."
          phase={3}
          features={["Idée → script → tournage → montage → publié", "Banque de hooks et d'inspirations", "Statistiques par publication", "Calendrier éditorial"]}
        />
      );
    case "business":
      return (
        <EmptyState
          icon={ScaleIcon}
          title="Registre de décisions"
          description="Ce que tu as décidé, pourquoi, et ce que ça a donné."
          phase={3}
          features={["Décision, raisons, alternatives écartées", "Date de réévaluation rappelée", "Résultat constaté après coup", "Journal d'expériences : hypothèse → résultat"]}
        />
      );
    default:
      return <EmptyState icon={BookOpenIcon} title="Module" description="Ce template n'a pas de module dédié." />;
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
