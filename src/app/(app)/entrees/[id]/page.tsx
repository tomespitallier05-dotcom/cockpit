import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/dal";
import { listContactOptions } from "@/server/data/contacts";
import { getEntryDetail } from "@/server/data/entries";
import { listProjects } from "@/server/queries";
import { uploadConfigFor } from "@/server/upload-config";
import { EntryEditor } from "./entry-editor";
import { EntryIntelligence } from "./entry-intelligence";

export const metadata: Metadata = { title: "Entrée" };

export default function EntryPage({ params }: PageProps<"/entrees/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EntryLoader params={params} />
    </Suspense>
  );
}

async function EntryLoader({ params }: { params: PageProps<"/entrees/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [me, entry, projects, contacts] = await Promise.all([
    requireUser(),
    getEntryDetail(id),
    listProjects(),
    listContactOptions(),
  ]);
  if (!entry) notFound();

  const project = projects.find((item) => item.id === entry.projectId);
  const backHref = entry.inboxStatus === "inbox" ? "/inbox" : project ? `/projets/${project.slug}` : "/";

  return (
    <EntryEditor
      // Remount on navigation between entries so local state never leaks across.
      key={entry.id}
      entry={{
        id: entry.id,
        type: entry.type,
        title: entry.title,
        content: entry.content,
        occurredAt: entry.occurredAt,
        meta: entry.meta,
        inboxStatus: entry.inboxStatus,
        pinned: entry.pinned,
        projectId: entry.projectId,
        contactIds: entry.contacts.map((contact) => contact.id),
        files: entry.files.map(({ id: fileId, fileName, mimeType, sizeBytes, kind }) => ({
          id: fileId,
          fileName,
          mimeType,
          sizeBytes,
          kind,
        })),
      }}
      projects={projects.map(({ id: projectId, name, icon, color }) => ({ id: projectId, name, icon, color }))}
      contacts={contacts}
      uploadConfig={uploadConfigFor(me)}
      backHref={backHref}
    >
      <Suspense fallback={<Skeleton className="mt-8 h-40 w-full rounded-2xl" />}>
        <EntryIntelligence entry={entry} />
      </Suspense>
    </EntryEditor>
  );
}

function EditorSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-8">
      <Skeleton className="h-7 w-24 rounded-lg" />
      <Skeleton className="mt-8 h-9 w-2/3 rounded-lg" />
      <Skeleton className="mt-6 h-28 w-full rounded-xl" />
      <Skeleton className="mt-8 h-64 w-full rounded-xl" />
    </div>
  );
}
