import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EntryTimeline } from "@/components/entries/entry-timeline";
import { PageContainer } from "@/components/page-header";
import { ProjectIcon } from "@/components/project-icon";
import { Reveal } from "@/components/reveal";
import { CardEmpty } from "@/components/section-card";
import { TaskBoard } from "@/components/tasks/task-board";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContactRelationship } from "@/lib/entry-catalog";
import { requireUser } from "@/server/dal";
import { getContactDetail, listContactOptions } from "@/server/data/contacts";
import { toTaskView } from "@/server/data/task-views";
import { listTasks } from "@/server/data/tasks";
import { listProjects } from "@/server/queries";
import { ContactHeader } from "./contact-header";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <PageContainer>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground">
        <Link href="/contacts">
          <ArrowLeftIcon /> Contacts
        </Link>
      </Button>
      <Suspense fallback={<Skeleton className="h-60 w-full rounded-2xl" />}>
        <ContactLoader params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function ContactLoader({ params }: { params: PageProps<"/contacts/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [me, contact, projects, contacts, tasks] = await Promise.all([
    requireUser(),
    getContactDetail(id),
    listProjects(),
    listContactOptions(),
    listTasks({ contactId: id }),
  ]);
  if (!contact) notFound();
  const projectOptions = projects.map(({ id: projectId, name, icon, color }) => ({ id: projectId, name, icon, color }));

  return (
    <div className="flex flex-col gap-10">
      <Reveal>
        <ContactHeader
          contact={{
            id: contact.id,
            name: contact.name,
            role: contact.role,
            relationship: contact.relationship as ContactRelationship,
            company: contact.company,
            email: contact.email,
            phone: contact.phone,
            handles: contact.handles,
            notes: contact.notes,
            nextInteractionAt: contact.nextInteractionAt,
            projectIds: contact.projectIds,
          }}
          projects={projectOptions}
        />
      </Reveal>

      {contact.projects.length ? (
        <section>
          <h2 className="mb-2 text-[13.5px] font-medium text-foreground">Projets</h2>
          <div className="flex flex-wrap gap-2">
            {contact.projects.map((project) => (
              <Link
                key={project.id}
                href={`/projets/${project.slug}`}
                className="surface inline-flex items-center gap-2 px-3 py-1.5 text-[13px] text-foreground hover:border-white/12"
              >
                <ProjectIcon icon={project.icon} color={project.color} size="xs" /> {project.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-1 text-[13.5px] font-medium text-foreground">Tâches promises</h2>
        <p className="mb-3 text-[12.5px] text-subtle">Ce que tu t&apos;es engagé à faire pour {contact.name}.</p>
        <TaskBoard
          tasks={tasks.map(toTaskView)}
          projects={projectOptions}
          contacts={contacts}
          timeZone={me.timezone}
          defaultContactId={contact.id}
        />
      </section>

      <section>
        <h2 className="mb-3 text-[13.5px] font-medium text-foreground">Historique</h2>
        {contact.entries.length ? (
          <EntryTimeline entries={contact.entries} timeZone={me.timezone} />
        ) : (
          <CardEmpty>
            Aucun échange enregistré. Dans un appel ou un message, ajoute {contact.name} dans le champ « Avec » ou « De ».
          </CardEmpty>
        )}
      </section>
    </div>
  );
}
