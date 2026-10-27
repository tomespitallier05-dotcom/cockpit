import "server-only";
import { count, eq } from "drizzle-orm";
import { PROJECT_TEMPLATES, STARTER_PROJECTS } from "@/lib/project-catalog";
import { db } from "./db";
import { project, user, workspace } from "./db/schema";

/**
 * Cockpit is a single-owner app: the first account becomes the owner, and no
 * further sign-ups are accepted. OWNER_EMAIL pins which address may claim it,
 * and is required in production so a fresh deployment can't be claimed by a stranger.
 */
export async function assertCanCreateOwner(email: string): Promise<string | null> {
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (process.env.NODE_ENV === "production" && !ownerEmail) {
    return "OWNER_EMAIL doit être défini en production avant de créer le compte.";
  }
  if (ownerEmail && email.trim().toLowerCase() !== ownerEmail) {
    return "Cette adresse n'est pas autorisée à créer le compte propriétaire.";
  }
  const [{ users }] = await db.select({ users: count() }).from(user);
  if (users > 0) {
    return "Le compte propriétaire existe déjà.";
  }
  return null;
}

export async function hasOwner(): Promise<boolean> {
  const [{ users }] = await db.select({ users: count() }).from(user);
  return users > 0;
}

/** Creates the workspace and the starter projects, so the app never opens empty. */
export async function provisionWorkspace(owner: { id: string; name: string }) {
  await db.transaction(async (tx) => {
    const [ws] = await tx
      .insert(workspace)
      .values({ name: `Espace de ${owner.name.split(" ")[0] || owner.name}`, ownerId: owner.id })
      .returning({ id: workspace.id });

    await tx.insert(project).values(
      STARTER_PROJECTS.map((starter, position) => {
        const template = PROJECT_TEMPLATES[starter.template];
        return {
          workspaceId: ws.id,
          name: starter.name,
          slug: starter.slug,
          description: starter.description,
          template: starter.template,
          icon: template.icon,
          color: template.color,
          position,
        };
      }),
    );
  });
}

export async function findWorkspaceByOwner(ownerId: string) {
  const [ws] = await db
    .select({ id: workspace.id, name: workspace.name, timezone: workspace.timezone })
    .from(workspace)
    .where(eq(workspace.ownerId, ownerId))
    .limit(1);
  return ws ?? null;
}
