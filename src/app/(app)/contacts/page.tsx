import { UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/dal";
import { listContacts } from "@/server/data/contacts";
import { listProjects } from "@/server/queries";
import { ContactsView } from "./contacts-view";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  return (
    <PageContainer>
      <PageHeader
        title="Contacts"
        description="Ton CRM personnel : mentors, clients, fournisseurs et partenaires, avec tout l'historique de vos échanges."
        icon={<PageIcon icon={UsersIcon} />}
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-2xl" />}>
          <ContactsLoader searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}

async function ContactsLoader({ searchParams }: { searchParams: PageProps<"/contacts">["searchParams"] }) {
  const params = await searchParams;
  const [me, contacts, projects] = await Promise.all([requireUser(), listContacts(), listProjects()]);
  return (
    <ContactsView
      contacts={contacts.map(({ id, name, role, relationship, company, lastEntryAt, nextInteractionAt }) => ({
        id,
        name,
        role,
        relationship,
        company,
        lastEntryAt: lastEntryAt ? new Date(lastEntryAt) : null,
        nextInteractionAt,
      }))}
      projects={projects.map(({ id, name, icon, color }) => ({ id, name, icon, color }))}
      timeZone={me.timezone}
      openNew={params.nouveau === "1"}
    />
  );
}
