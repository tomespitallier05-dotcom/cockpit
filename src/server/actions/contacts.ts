"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { CONTACT_RELATIONSHIPS, type ContactRelationship } from "@/lib/entry-catalog";
import { assertOwnProject, fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { contact, projectContact } from "../db/schema";
import { getActionUser } from "../session";

const contactId = z.uuid();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const contactInput = z.object({
  name: z.string().trim().min(1, "Donne un nom au contact.").max(120),
  role: optionalText(120),
  relationship: z.enum(Object.keys(CONTACT_RELATIONSHIPS) as [ContactRelationship, ...ContactRelationship[]]).default("other"),
  company: optionalText(120),
  email: z.union([z.email("Email invalide."), z.literal("")]).nullable().optional(),
  phone: optionalText(40),
  handles: z
    .object({ instagram: z.string().trim().max(80), discord: z.string().trim().max(80), whatsapp: z.string().trim().max(40) })
    .partial()
    .default({}),
  notes: optionalText(10_000),
  nextInteractionAt: z.coerce.date().nullable().optional(),
  projectIds: z.array(z.uuid()).default([]),
});

export type ContactInput = z.input<typeof contactInput>;

function message(error: unknown) {
  return error instanceof z.ZodError ? new Error(error.issues[0]?.message ?? "Données invalides.") : error;
}

/** Empty strings from forms are stored as NULL; project links are written separately. */
function clean(data: z.output<typeof contactInput>) {
  return {
    name: data.name,
    role: data.role || null,
    relationship: data.relationship,
    company: data.company || null,
    email: data.email || null,
    phone: data.phone || null,
    handles: Object.fromEntries(Object.entries(data.handles).filter(([, value]) => value)),
    notes: data.notes || null,
    nextInteractionAt: data.nextInteractionAt,
  };
}

async function linkProjects(
  me: Awaited<ReturnType<typeof getActionUser>>,
  id: string,
  projectIds: string[],
) {
  for (const projectId of projectIds) await assertOwnProject(me, projectId);
  await db.transaction(async (tx) => {
    await tx.delete(projectContact).where(eq(projectContact.contactId, id));
    if (projectIds.length) await tx.insert(projectContact).values(projectIds.map((projectId) => ({ projectId, contactId: id })));
  });
}

export async function createContact(input: ContactInput): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await getActionUser();
    const data = contactInput.parse(input);
    const [created] = await db
      .insert(contact)
      .values({ ...clean(data), workspaceId: me.workspaceId })
      .returning({ id: contact.id });
    await linkProjects(me, created.id, data.projectIds);
    refresh();
    return ok({ id: created.id });
  } catch (error) {
    return fail(message(error));
  }
}

export async function updateContact(id: string, input: ContactInput): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const data = contactInput.parse(input);
    const [updated] = await db
      .update(contact)
      .set(clean(data))
      .where(and(eq(contact.id, contactId.parse(id)), eq(contact.workspaceId, me.workspaceId), isNull(contact.deletedAt)))
      .returning({ id: contact.id });
    if (!updated) throw new Error("Contact introuvable.");
    await linkProjects(me, id, data.projectIds);
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}

export async function deleteContact(id: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await db
      .update(contact)
      .set({ deletedAt: new Date() })
      .where(and(eq(contact.id, contactId.parse(id)), eq(contact.workspaceId, me.workspaceId)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}
