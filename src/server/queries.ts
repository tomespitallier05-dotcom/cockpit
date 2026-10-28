import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "./db";
import { entry, insight, project, task, user, workspace } from "./db/schema";
import { requireUser } from "./dal";

// Every exported query resolves the current user itself, so callers can never
// read another workspace's data by passing an id.


export type ProjectSummary = Awaited<ReturnType<typeof listProjects>>[number];

export async function listProjects() {
  const me = await requireUser();
  return db
    .select({
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      icon: project.icon,
      color: project.color,
      template: project.template,
      status: project.status,
      startedAt: project.startedAt,
    })
    .from(project)
    .where(
      and(
        eq(project.workspaceId, me.workspaceId),
        isNull(project.deletedAt),
        ne(project.status, "archived"),
      ),
    )
    .orderBy(asc(project.position), asc(project.createdAt));
}

export async function getProjectBySlug(slug: string) {
  const me = await requireUser();
  const [found] = await db
    .select()
    .from(project)
    .where(
      and(
        eq(project.workspaceId, me.workspaceId),
        eq(project.slug, slug),
        isNull(project.deletedAt),
      ),
    )
    .limit(1);
  return found ?? null;
}

/**
 * Read from the table rather than the cached session, so the settings page shows
 * the new state right after 2FA is turned on or off.
 */
export async function getSecurityStatus() {
  const me = await requireUser();
  const [row] = await db
    .select({ twoFactorEnabled: user.twoFactorEnabled })
    .from(user)
    .where(eq(user.id, me.id));
  return { twoFactorEnabled: Boolean(row?.twoFactorEnabled) };
}

/** Numbers that matter on the Today page — no vanity counters. */
export async function getTodayStats() {
  const me = await requireUser();
  const ws = me.workspaceId;

  const [[projects], [openTasks], [inbox], [pendingAdvice]] = await Promise.all([
    db
      .select({ n: count() })
      .from(project)
      .where(and(eq(project.workspaceId, ws), eq(project.status, "active"), isNull(project.deletedAt))),
    db
      .select({ n: count() })
      .from(task)
      .where(
        and(
          eq(task.workspaceId, ws),
          inArray(task.status, ["todo", "in_progress"]),
          isNull(task.deletedAt),
        ),
      ),
    db
      .select({ n: count() })
      .from(entry)
      .where(and(eq(entry.workspaceId, ws), eq(entry.inboxStatus, "inbox"), isNull(entry.deletedAt))),
    db
      .select({ n: count() })
      .from(insight)
      .where(
        and(
          eq(insight.workspaceId, ws),
          eq(insight.type, "advice"),
          inArray(insight.status, ["proposed", "accepted"]),
        ),
      ),
  ]);

  return {
    activeProjects: projects.n,
    openTasks: openTasks.n,
    inbox: inbox.n,
    pendingAdvice: pendingAdvice.n,
  };
}

export type ActivityItem = {
  id: string;
  kind: "workspace" | "project" | "entry";
  title: string;
  detail?: string;
  color?: string;
  at: Date;
};

/** Recent timeline. Entries take over as soon as capture exists (phase 1). */
export async function getRecentActivity(limit = 6): Promise<ActivityItem[]> {
  const me = await requireUser();
  const ws = me.workspaceId;

  const [entries, projects, [space]] = await Promise.all([
    db
      .select({
        id: entry.id,
        title: entry.title,
        plainText: entry.plainText,
        type: entry.type,
        at: entry.occurredAt,
        color: project.color,
        projectName: project.name,
      })
      .from(entry)
      .leftJoin(project, eq(entry.projectId, project.id))
      .where(and(eq(entry.workspaceId, ws), isNull(entry.deletedAt)))
      .orderBy(desc(entry.occurredAt))
      .limit(limit),
    db
      .select({ id: project.id, name: project.name, color: project.color, at: project.createdAt })
      .from(project)
      .where(and(eq(project.workspaceId, ws), isNull(project.deletedAt)))
      .orderBy(desc(project.createdAt))
      .limit(limit),
    db
      .select({ id: workspace.id, at: workspace.createdAt })
      .from(workspace)
      .where(eq(workspace.id, ws)),
  ]);

  const items: ActivityItem[] = [
    ...entries.map((e) => ({
      id: e.id,
      kind: "entry" as const,
      title: e.title || e.plainText.split("\n").find((line) => line.trim())?.trim().slice(0, 120) || "Sans titre",
      detail: e.projectName ?? undefined,
      color: e.color ?? undefined,
      at: e.at,
    })),
    ...projects.map((p) => ({
      id: p.id,
      kind: "project" as const,
      title: `Projet « ${p.name} » créé`,
      color: p.color,
      at: p.at,
    })),
    ...(space ? [{ id: space.id, kind: "workspace" as const, title: "Espace Cockpit créé", at: space.at }] : []),
  ];

  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
