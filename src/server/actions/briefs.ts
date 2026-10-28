"use server";

import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { generateText, textBlock } from "../ai/claude";
import { aiMock, claudeAvailable } from "../ai/config";
import { fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { contact, entry, entryContact, insight, task } from "../db/schema";
import { getActionUser } from "../session";

export type CallBrief = {
  contact: { id: string; name: string; role: string | null; relationship: string; nextInteractionAt: Date | null };
  lastEntries: { id: string; title: string; type: string; occurredAt: Date; summary: string | null }[];
  promises: { id: string; title: string; dueAt: Date | null; status: string }[];
  adviceToReport: { id: string; content: string; status: string; appliedAt: Date | null }[];
  decisions: { id: string; content: string }[];
  aiAvailable: boolean;
};

async function loadBrief(workspaceId: string, contactId: string): Promise<CallBrief> {
  const [person] = await db
    .select({ id: contact.id, name: contact.name, role: contact.role, relationship: contact.relationship, nextInteractionAt: contact.nextInteractionAt })
    .from(contact)
    .where(and(eq(contact.id, contactId), eq(contact.workspaceId, workspaceId), isNull(contact.deletedAt)));
  if (!person) throw new Error("Contact introuvable.");

  const linkedEntries = await db
    .select({ id: entry.id, title: entry.title, plainText: entry.plainText, type: entry.type, occurredAt: entry.occurredAt, meta: entry.meta })
    .from(entryContact)
    .innerJoin(entry, eq(entry.id, entryContact.entryId))
    .where(and(eq(entryContact.contactId, contactId), isNull(entry.deletedAt), eq(entry.workspaceId, workspaceId)))
    .orderBy(desc(entry.occurredAt))
    .limit(30);
  const entryIds = linkedEntries.map((e) => e.id);
  const since = new Date(Date.now() - 90 * 86400000);

  const [promises, advice, decisions] = await Promise.all([
    db
      .select({ id: task.id, title: task.title, dueAt: task.dueAt, status: task.status })
      .from(task)
      .where(and(eq(task.workspaceId, workspaceId), eq(task.promisedToContactId, contactId), isNull(task.deletedAt), inArray(task.status, ["todo", "in_progress"])))
      .orderBy(task.dueAt),
    db
      .select({ id: insight.id, content: insight.content, status: insight.status, appliedAt: insight.appliedAt })
      .from(insight)
      .where(
        and(
          eq(insight.workspaceId, workspaceId),
          eq(insight.contactId, contactId),
          eq(insight.type, "advice"),
          inArray(insight.status, ["accepted", "applied"]),
          gte(insight.updatedAt, since),
        ),
      )
      .orderBy(desc(insight.updatedAt))
      .limit(15),
    entryIds.length
      ? db
          .select({ id: insight.id, content: insight.content })
          .from(insight)
          .where(and(inArray(insight.sourceEntryId, entryIds), eq(insight.type, "decision"), inArray(insight.status, ["proposed", "accepted", "applied"])))
          .orderBy(desc(insight.createdAt))
          .limit(8)
      : Promise.resolve([]),
  ]);

  return {
    contact: person,
    lastEntries: linkedEntries.slice(0, 5).map((e) => ({
      id: e.id,
      title: e.title || e.plainText.split("\n").find((l) => l.trim())?.slice(0, 80) || "Sans titre",
      type: e.type,
      occurredAt: e.occurredAt,
      summary: ((e.meta as { ai?: { suggestion?: { summary?: string } } }).ai?.suggestion?.summary as string | undefined) ?? null,
    })),
    promises,
    adviceToReport: advice,
    decisions,
    aiAvailable: claudeAvailable(),
  };
}

export async function getCallBrief(contactId: string): Promise<ActionResult<CallBrief>> {
  try {
    const me = await getActionUser();
    return ok(await loadBrief(me.workspaceId, z.uuid().parse(contactId)));
  } catch (error) {
    return fail(error);
  }
}

/** A short agenda for the next call, from what was promised, advised and decided. */
export async function generateCallAgenda(contactId: string): Promise<ActionResult<string>> {
  try {
    const me = await getActionUser();
    const brief = await loadBrief(me.workspaceId, z.uuid().parse(contactId));
    if (aiMock()) {
      return ok(
        `- Faire le point sur ${brief.promises.length} engagement(s) en cours\n- Rapporter ${brief.adviceToReport.filter((a) => a.status === "applied").length} conseil(s) appliqué(s)\n- Question à poser : prochaine étape prioritaire ? (ordre du jour simulé, AI_MOCK)`,
      );
    }
    const facts = [
      `Personne : ${brief.contact.name}${brief.contact.role ? `, ${brief.contact.role}` : ""} (${brief.contact.relationship})`,
      `Engagements pris envers elle, pas encore tenus :\n${brief.promises.map((p) => `- ${p.title}${p.dueAt ? ` (échéance ${p.dueAt.toISOString().slice(0, 10)})` : ""}`).join("\n") || "aucun"}`,
      `Ses conseils retenus :\n${brief.adviceToReport.map((a) => `- ${a.content} — ${a.status === "applied" ? "appliqué" : "pas encore appliqué"}`).join("\n") || "aucun"}`,
      `Décisions récentes liées à elle :\n${brief.decisions.map((d) => `- ${d.content}`).join("\n") || "aucune"}`,
      `Derniers échanges :\n${brief.lastEntries.map((e) => `- ${e.occurredAt.toISOString().slice(0, 10)} · ${e.title}${e.summary ? ` : ${e.summary}` : ""}`).join("\n") || "aucun"}`,
    ].join("\n\n");
    const text = await generateText({
      workspaceId: me.workspaceId,
      feature: "brief",
      effort: "low",
      maxTokens: 4000,
      system:
        "Tu prépares un entrepreneur francophone à un appel. Propose un ordre du jour court (5 points au plus, en liste à puces) : ce qu'il doit rapporter (engagements tenus ou non, conseils appliqués et leurs résultats), les questions à poser, la décision à obtenir. Tutoie-le. N'invente aucun fait absent des données.",
      content: [textBlock(facts)],
    });
    return ok(text);
  } catch (error) {
    return fail(error);
  }
}
