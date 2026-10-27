import "server-only";
import { and, asc, desc, eq, inArray, isNull, max } from "drizzle-orm";
import { requireUser } from "../dal";
import { db } from "../db";
import { contact, entry, entryContact, project, projectContact } from "../db/schema";

export type ContactListItem = Awaited<ReturnType<typeof listContacts>>[number];

export async function listContacts() {
  const me = await requireUser();
  const rows = await db
    .select({
      id: contact.id,
      name: contact.name,
      role: contact.role,
      relationship: contact.relationship,
      company: contact.company,
      email: contact.email,
      phone: contact.phone,
      handles: contact.handles,
      notes: contact.notes,
      nextInteractionAt: contact.nextInteractionAt,
      lastEntryAt: max(entry.occurredAt),
    })
    .from(contact)
    .leftJoin(entryContact, eq(entryContact.contactId, contact.id))
    .leftJoin(entry, and(eq(entryContact.entryId, entry.id), isNull(entry.deletedAt)))
    .where(and(eq(contact.workspaceId, me.workspaceId), isNull(contact.deletedAt)))
    .groupBy(contact.id)
    .orderBy(asc(contact.name));

  const links = await projectLinks(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, projectIds: links.get(row.id) ?? [] }));
}

async function projectLinks(contactIds: string[]) {
  const map = new Map<string, string[]>();
  if (contactIds.length === 0) return map;
  const rows = await db
    .select({ contactId: projectContact.contactId, projectId: projectContact.projectId })
    .from(projectContact)
    .where(inArray(projectContact.contactId, contactIds));
  for (const row of rows) map.set(row.contactId, [...(map.get(row.contactId) ?? []), row.projectId]);
  return map;
}

/** Light list for pickers. */
export async function listContactOptions() {
  const me = await requireUser();
  return db
    .select({ id: contact.id, name: contact.name, role: contact.role })
    .from(contact)
    .where(and(eq(contact.workspaceId, me.workspaceId), isNull(contact.deletedAt)))
    .orderBy(asc(contact.name));
}

export async function getContactDetail(id: string) {
  const me = await requireUser();
  const [row] = await db
    .select()
    .from(contact)
    .where(and(eq(contact.id, id), eq(contact.workspaceId, me.workspaceId), isNull(contact.deletedAt)))
    .limit(1);
  if (!row) return null;

  const [entries, projects] = await Promise.all([
    db
      .select({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        plainText: entry.plainText,
        occurredAt: entry.occurredAt,
        inboxStatus: entry.inboxStatus,
        pinned: entry.pinned,
        source: entry.source,
        projectId: entry.projectId,
        projectName: project.name,
        projectSlug: project.slug,
        projectColor: project.color,
        projectIcon: project.icon,
      })
      .from(entryContact)
      .innerJoin(entry, eq(entryContact.entryId, entry.id))
      .leftJoin(project, eq(entry.projectId, project.id))
      .where(and(eq(entryContact.contactId, id), isNull(entry.deletedAt)))
      .orderBy(desc(entry.occurredAt))
      .limit(100),
    db
      .select({ id: project.id, name: project.name, slug: project.slug, icon: project.icon, color: project.color })
      .from(projectContact)
      .innerJoin(project, eq(projectContact.projectId, project.id))
      .where(and(eq(projectContact.contactId, id), isNull(project.deletedAt))),
  ]);

  return { ...row, entries, projects, projectIds: projects.map((p) => p.id) };
}

export async function listProjectContacts(projectId: string) {
  const me = await requireUser();
  return db
    .select({ id: contact.id, name: contact.name, role: contact.role, relationship: contact.relationship })
    .from(projectContact)
    .innerJoin(contact, eq(projectContact.contactId, contact.id))
    .where(and(eq(projectContact.projectId, projectId), eq(contact.workspaceId, me.workspaceId), isNull(contact.deletedAt)))
    .orderBy(asc(contact.name));
}
