import { and, eq, inArray, isNull } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  attachment,
  contact,
  contentItem,
  dailyBrief,
  entry,
  entryContact,
  goal,
  insight,
  inventoryItem,
  metric,
  metricValue,
  project,
  projectContact,
  review,
  task,
} from "@/server/db/schema";
import { getRequestUser } from "@/server/session";

export const maxDuration = 120;

/**
 * Full export, so the data is never locked in: `?format=json` (everything,
 * machine-readable) or `?format=markdown` (a zip of readable notes by project).
 * Files themselves stay in storage; their names and keys are listed.
 */
/** The generated full-text column is an index, not data. */
function withoutSearch<T extends { search: unknown }>(row: T) {
  const copy: Partial<T> = { ...row };
  delete copy.search;
  return copy;
}

export async function GET(request: Request) {
  const me = await getRequestUser(request);
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const ws = me.workspaceId;
  const format = new URL(request.url).searchParams.get("format") === "markdown" ? "markdown" : "json";

  const [projects, contacts, entries, tasks, insights, metrics, goals, inventory, content, reviews, briefs, files] = await Promise.all([
    db.select().from(project).where(and(eq(project.workspaceId, ws), isNull(project.deletedAt))),
    db.select().from(contact).where(and(eq(contact.workspaceId, ws), isNull(contact.deletedAt))),
    db.select().from(entry).where(and(eq(entry.workspaceId, ws), isNull(entry.deletedAt))),
    db.select().from(task).where(and(eq(task.workspaceId, ws), isNull(task.deletedAt))),
    db.select().from(insight).where(eq(insight.workspaceId, ws)),
    db.select().from(metric).where(eq(metric.workspaceId, ws)),
    db.select().from(goal).where(eq(goal.workspaceId, ws)),
    db.select().from(inventoryItem).where(and(eq(inventoryItem.workspaceId, ws), isNull(inventoryItem.deletedAt))),
    db.select().from(contentItem).where(and(eq(contentItem.workspaceId, ws), isNull(contentItem.deletedAt))),
    db.select().from(review).where(eq(review.workspaceId, ws)),
    db.select().from(dailyBrief).where(eq(dailyBrief.workspaceId, ws)),
    db
      .select({ id: attachment.id, entryId: attachment.entryId, fileName: attachment.fileName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes, storageKey: attachment.storageKey, extractedText: attachment.extractedText })
      .from(attachment)
      .where(eq(attachment.workspaceId, ws)),
  ]);
  const entryIds = entries.map((e) => e.id);
  const [links, values, memberships] = await Promise.all([
    entryIds.length ? db.select().from(entryContact).where(inArray(entryContact.entryId, entryIds)) : [],
    metrics.length ? db.select().from(metricValue).where(inArray(metricValue.metricId, metrics.map((m) => m.id))) : [],
    projects.length ? db.select().from(projectContact).where(inArray(projectContact.projectId, projects.map((p) => p.id))) : [],
  ]);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const body = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        projects,
        projectContacts: memberships,
        contacts,
        entries: entries.map(withoutSearch),
        entryContacts: links,
        attachments: files,
        tasks: tasks.map(withoutSearch),
        insights,
        metrics,
        metricValues: values,
        goals,
        inventory,
        content,
        reviews,
        briefs,
      },
      null,
      2,
    );
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="cockpit-${stamp}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const slug = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "sans-titre";
  const projectSlug = new Map(projects.map((p) => [p.id, p.slug]));
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));
  const tree: Record<string, Uint8Array> = {};
  for (const e of entries) {
    const folder = e.projectId ? (projectSlug.get(e.projectId) ?? "projet") : "inbox";
    const date = e.occurredAt.toISOString().slice(0, 10);
    const people = links.filter((l) => l.entryId === e.id).map((l) => contactName.get(l.contactId)).filter(Boolean);
    const attached = files.filter((f) => f.entryId === e.id);
    const lines = [
      "---",
      `type: ${e.type}`,
      `date: ${e.occurredAt.toISOString()}`,
      people.length ? `contacts: [${people.join(", ")}]` : null,
      e.source !== "manual" ? `source: ${e.source}` : null,
      "---",
      "",
      `# ${e.title || "Sans titre"}`,
      "",
      e.plainText,
      ...attached.map((f) => `\n## Fichier : ${f.fileName}\n\n${f.extractedText ?? ""}`),
      ...insights
        .filter((i) => i.sourceEntryId === e.id && i.status !== "dismissed")
        .map((i, index) => `${index === 0 ? "\n## Extraits\n\n" : ""}- (${i.type}) ${i.content}`),
    ].filter((line) => line !== null);
    tree[`${folder}/${date}-${slug(e.title || e.plainText.slice(0, 40))}-${e.id.slice(0, 6)}.md`] = strToU8(lines.join("\n"));
  }
  tree["taches.md"] = strToU8(
    `# Tâches\n\n${tasks.map((t) => `- [${t.status === "done" ? "x" : " "}] ${t.title}${t.dueAt ? ` (échéance ${t.dueAt.toISOString().slice(0, 10)})` : ""}`).join("\n")}\n`,
  );
  tree["contacts.md"] = strToU8(`# Contacts\n\n${contacts.map((c) => `- ${c.name}${c.role ? `, ${c.role}` : ""}${c.email ? ` <${c.email}>` : ""}`).join("\n")}\n`);
  tree["bilans.md"] = strToU8(`# Bilans\n\n${reviews.map((r) => `## ${r.period} ${r.periodStart}\n\n${r.summary ?? ""}\n`).join("\n")}`);
  const zip = zipSync(tree, { level: 6 });
  return new Response(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="cockpit-${stamp}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
