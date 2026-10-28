"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { assertOwnProject, fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { CONTENT_STAGES, contentItem, inventoryItem } from "../db/schema";
import { getActionUser } from "../session";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const cents = z.number().int().min(0).max(100_000_000);

function message(error: unknown) {
  return error instanceof z.ZodError ? new Error(error.issues[0]?.message ?? "Données invalides.") : error;
}

// --- Resale inventory --------------------------------------------------------

const itemInput = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(1, "Nomme l'article.").max(160),
  category: z.string().trim().max(60).nullable().optional(),
  brand: z.string().trim().max(60).nullable().optional(),
  condition: z.string().trim().max(60).nullable().optional(),
  sourcedFrom: z.string().trim().max(80).nullable().optional(),
  platform: z.string().trim().max(60).nullable().optional(),
  buyPriceCents: cents,
  sellPriceCents: cents.nullable().optional(),
  feesCents: cents.default(0),
  status: z.enum(["sourced", "listed", "sold", "returned", "kept"]).default("sourced"),
  boughtOn: day,
  listedOn: day,
  soldOn: day,
  notes: z.string().trim().max(2000).nullable().optional(),
});

function blankToNull<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])) as T;
}

export async function saveInventoryItem(id: string | null, input: z.input<typeof itemInput>): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await getActionUser();
    const data = blankToNull(itemInput.parse(input));
    const projectId = await assertOwnProject(me, data.projectId);
    if (!projectId) throw new Error("Projet introuvable.");
    if (data.status === "sold" && !data.soldOn) data.soldOn = new Date().toISOString().slice(0, 10);
    if (id) {
      await db
        .update(inventoryItem)
        .set({ ...data, projectId })
        .where(and(eq(inventoryItem.id, z.uuid().parse(id)), eq(inventoryItem.workspaceId, me.workspaceId)));
      refresh();
      return ok({ id });
    }
    const [row] = await db
      .insert(inventoryItem)
      .values({ ...data, projectId, workspaceId: me.workspaceId })
      .returning({ id: inventoryItem.id });
    refresh();
    return ok({ id: row.id });
  } catch (error) {
    return fail(message(error));
  }
}

export async function deleteInventoryItem(id: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await db
      .update(inventoryItem)
      .set({ deletedAt: new Date() })
      .where(and(eq(inventoryItem.id, z.uuid().parse(id)), eq(inventoryItem.workspaceId, me.workspaceId)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}

// --- Content pipeline --------------------------------------------------------

const statsSchema = z
  .object({
    views: z.number().int().min(0).optional(),
    likes: z.number().int().min(0).optional(),
    comments: z.number().int().min(0).optional(),
    saves: z.number().int().min(0).optional(),
    shares: z.number().int().min(0).optional(),
    followers: z.number().int().optional(),
  })
  .partial();

const contentInput = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1, "Donne un titre.").max(200),
  format: z.enum(["reel", "carousel", "story", "post", "video", "other"]).default("reel"),
  stage: z.enum(CONTENT_STAGES).default("idea"),
  hook: z.string().trim().max(300).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  scheduledOn: day,
  publishedOn: day,
  url: z.union([z.url(), z.literal("")]).nullable().optional(),
  stats: statsSchema.default({}),
});

export async function saveContentItem(id: string | null, input: z.input<typeof contentInput>): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await getActionUser();
    const data = blankToNull(contentInput.parse(input));
    const projectId = await assertOwnProject(me, data.projectId);
    if (!projectId) throw new Error("Projet introuvable.");
    if (data.stage === "published" && !data.publishedOn) data.publishedOn = new Date().toISOString().slice(0, 10);
    if (id) {
      await db
        .update(contentItem)
        .set({ ...data, projectId })
        .where(and(eq(contentItem.id, z.uuid().parse(id)), eq(contentItem.workspaceId, me.workspaceId)));
      refresh();
      return ok({ id });
    }
    const [row] = await db
      .insert(contentItem)
      .values({ ...data, projectId, workspaceId: me.workspaceId })
      .returning({ id: contentItem.id });
    refresh();
    return ok({ id: row.id });
  } catch (error) {
    return fail(message(error));
  }
}

export async function moveContentItem(id: string, stage: (typeof CONTENT_STAGES)[number]): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const next = z.enum(CONTENT_STAGES).parse(stage);
    const [row] = await db
      .select({ publishedOn: contentItem.publishedOn })
      .from(contentItem)
      .where(and(eq(contentItem.id, z.uuid().parse(id)), eq(contentItem.workspaceId, me.workspaceId)));
    if (!row) throw new Error("Contenu introuvable.");
    await db
      .update(contentItem)
      .set({ stage: next, publishedOn: next === "published" ? (row.publishedOn ?? new Date().toISOString().slice(0, 10)) : row.publishedOn })
      .where(eq(contentItem.id, id));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}

export async function deleteContentItem(id: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await db
      .update(contentItem)
      .set({ deletedAt: new Date() })
      .where(and(eq(contentItem.id, z.uuid().parse(id)), eq(contentItem.workspaceId, me.workspaceId)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}
