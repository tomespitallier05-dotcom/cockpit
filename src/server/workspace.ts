import "server-only";
import { count, eq } from "drizzle-orm";
import { PROJECT_TEMPLATES, STARTER_PROJECTS } from "@/lib/project-catalog";
import { db } from "./db";
import { project, user, workspace } from "./db/schema";

/**
 * Anyone may create an account: each account gets its own workspace, and every row of
 * data carries that workspace's id. Set SIGNUPS_DISABLED=1 to close registration again
 * (existing accounts keep working).
 */
export async function assertCanSignUp(): Promise<string | null> {
  if (process.env.SIGNUPS_DISABLED === "1") {
    return "Les inscriptions sont fermées pour le moment.";
  }
  return null;
}

/** True once the first account exists; before that, /setup creates it. */
export async function hasOwner(): Promise<boolean> {
  const [{ users }] = await db.select({ users: count() }).from(user);
  return users > 0;
}

/**
 * Creates the user's workspace and the starter projects, so the app never opens empty.
 * Safe to call twice: one workspace per user (unique owner_id), the second call does nothing.
 */
export async function provisionWorkspace(owner: { id: string; name: string }) {
  await db.transaction(async (tx) => {
    const [ws] = await tx
      .insert(workspace)
      .values({ name: `Espace de ${owner.name.split(" ")[0] || owner.name}`, ownerId: owner.id })
      .onConflictDoNothing({ target: workspace.ownerId })
      .returning({ id: workspace.id });
    if (!ws) return;

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
