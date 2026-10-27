"use server";

import { and, eq, isNull, like, max, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import {
  PROJECT_COLORS,
  PROJECT_ICON_NAMES,
  PROJECT_STATUSES,
  slugify,
  type ProjectColor,
} from "@/lib/project-catalog";
import { fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { project } from "../db/schema";
import { getActionUser } from "../session";

const projectInput = z.object({
  name: z.string().trim().min(1, "Donne un nom au projet.").max(80, "80 caractères maximum."),
  description: z.string().trim().max(280, "280 caractères maximum.").default(""),
  template: z.enum(["resale", "content", "business", "blank"]),
  icon: z.enum(PROJECT_ICON_NAMES),
  color: z.enum(Object.keys(PROJECT_COLORS) as [ProjectColor, ...ProjectColor[]]),
});

export type ProjectInput = z.input<typeof projectInput>;

async function uniqueSlug(workspaceId: string, name: string, excludeId?: string) {
  const base = slugify(name) || "projet";
  const taken = await db
    .select({ id: project.id, slug: project.slug })
    .from(project)
    .where(and(eq(project.workspaceId, workspaceId), or(eq(project.slug, base), like(project.slug, `${base}-%`))));
  const slugs = new Set(taken.filter((row) => row.id !== excludeId).map((row) => row.slug));
  if (!slugs.has(base)) return base;
  let n = 2;
  while (slugs.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export async function createProject(input: ProjectInput): Promise<ActionResult<{ slug: string }>> {
  try {
    const me = await getActionUser();
    const data = projectInput.parse(input);
    const slug = await uniqueSlug(me.workspaceId, data.name);
    const [{ last }] = await db
      .select({ last: max(project.position) })
      .from(project)
      .where(eq(project.workspaceId, me.workspaceId));
    await db.insert(project).values({
      workspaceId: me.workspaceId,
      name: data.name,
      slug,
      description: data.description || null,
      template: data.template,
      icon: data.icon,
      color: data.color,
      position: (last ?? -1) + 1,
    });
    refresh();
    return ok({ slug });
  } catch (error) {
    return fail(error instanceof z.ZodError ? new Error(error.issues[0]?.message) : error);
  }
}

const projectUpdate = projectInput.partial().extend({ status: z.enum(PROJECT_STATUSES).optional() });

export async function updateProject(
  id: string,
  input: z.input<typeof projectUpdate>,
): Promise<ActionResult<{ slug: string }>> {
  try {
    const me = await getActionUser();
    const data = projectUpdate.parse(input);
    const [current] = await db
      .select({ slug: project.slug, name: project.name })
      .from(project)
      .where(and(eq(project.id, z.uuid().parse(id)), eq(project.workspaceId, me.workspaceId), isNull(project.deletedAt)));
    if (!current) throw new Error("Projet introuvable.");

    const slug = data.name && data.name !== current.name ? await uniqueSlug(me.workspaceId, data.name, id) : current.slug;
    await db
      .update(project)
      .set({
        ...data,
        description: data.description === undefined ? undefined : data.description || null,
        slug,
        archivedAt: data.status === undefined ? undefined : data.status === "archived" ? new Date() : null,
      })
      .where(and(eq(project.id, id), eq(project.workspaceId, me.workspaceId)));
    refresh();
    return ok({ slug });
  } catch (error) {
    return fail(error instanceof z.ZodError ? new Error(error.issues[0]?.message) : error);
  }
}
