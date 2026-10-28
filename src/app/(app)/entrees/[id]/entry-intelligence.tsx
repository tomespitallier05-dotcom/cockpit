import { asc, eq } from "drizzle-orm";
import { aiStatus } from "@/server/ai/config";
import type { AiState } from "@/server/ai/pipeline";
import { requireUser } from "@/server/dal";
import { listContactOptions } from "@/server/data/contacts";
import type { EntryDetail } from "@/server/data/entries";
import { listEntryInsights } from "@/server/data/insights";
import { db } from "@/server/db";
import { attachment } from "@/server/db/schema";
import { listProjects } from "@/server/queries";
import { IntelligencePanel } from "./intelligence-panel";

/** The "understand" half of an entry: analysis state, suggestions, insights, transcripts. */
export async function EntryIntelligence({ entry }: { entry: EntryDetail }) {
  const [me, insights, projects, contacts, files] = await Promise.all([
    requireUser(),
    listEntryInsights(entry.id),
    listProjects(),
    listContactOptions(),
    db
      .select({
        id: attachment.id,
        fileName: attachment.fileName,
        kind: attachment.kind,
        extractedText: attachment.extractedText,
        processingStatus: attachment.processingStatus,
      })
      .from(attachment)
      .where(eq(attachment.entryId, entry.id))
      .orderBy(asc(attachment.createdAt)),
  ]);
  const ai = ((entry.meta as Record<string, unknown>).ai ?? null) as AiState | null;
  const suggestion = ai?.suggestion;
  const suggestedProject = suggestion?.projectId ? projects.find((p) => p.id === suggestion.projectId) : undefined;
  const linked = new Set(entry.contacts.map((c) => c.id));
  const suggestedContacts = (suggestion?.contactIds ?? [])
    .filter((id) => !linked.has(id))
    .map((id) => contacts.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <IntelligencePanel
      entryId={entry.id}
      isPrivate={entry.isPrivate}
      ai={ai}
      configured={aiStatus().claude}
      timeZone={me.timezone}
      insights={insights}
      suggestion={{
        summary: suggestion?.summary ?? null,
        title: suggestion?.title && suggestion.title !== entry.title ? suggestion.title : null,
        type: suggestion?.type && suggestion.type !== entry.type ? suggestion.type : null,
        project:
          suggestedProject && suggestedProject.id !== entry.projectId
            ? { id: suggestedProject.id, name: suggestedProject.name }
            : null,
        contacts: suggestedContacts.map((c) => ({ id: c.id, name: c.name })),
      }}
      files={files.filter((file) => file.extractedText || file.processingStatus !== "done")}
    />
  );
}
