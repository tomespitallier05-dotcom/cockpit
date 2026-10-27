import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "./db";
import { contact, project } from "./db/schema";
import { getCurrentUser, type CurrentUser } from "./session";

/**
 * The session may resolve during a prefetch, but the database reads that follow
 * must run at request time: Next can't see the embedded database as I/O, so
 * `connection()` says it explicitly.
 */
export async function requireUser() {
  const me = await getCurrentUser();
  await connection();
  return me;
}

/** Ids coming from the client must belong to the caller's workspace. */
export async function assertOwnProject(me: CurrentUser, projectId: string | null | undefined) {
  if (!projectId) return null;
  const [row] = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.workspaceId, me.workspaceId), isNull(project.deletedAt)));
  if (!row) throw new Error("Projet introuvable.");
  return row.id;
}

export async function assertOwnContacts(me: CurrentUser, contactIds: string[]) {
  if (contactIds.length === 0) return [];
  const rows = await db
    .select({ id: contact.id })
    .from(contact)
    .where(and(inArray(contact.id, contactIds), eq(contact.workspaceId, me.workspaceId), isNull(contact.deletedAt)));
  if (rows.length !== new Set(contactIds).size) throw new Error("Contact introuvable.");
  return rows.map((row) => row.id);
}

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: unknown): ActionResult<never> {
  if (error instanceof Error && error.message) return { ok: false, error: error.message };
  return { ok: false, error: "Une erreur est survenue." };
}
