"use server";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { dayKey, zonedInstant } from "@/lib/dates";
import { addDaysTo, periodRange, type Period } from "@/lib/periods";
import { generateReview } from "../ai/reviews";
import { fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { review, shareLink, task } from "../db/schema";
import { getActionUser } from "../session";

const periodSchema = z.enum(["day", "week", "month", "quarter", "year"]);

export async function generateReviewFor(period: Period, offset = -1): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await getActionUser();
    const p = periodSchema.parse(period);
    const range = periodRange(p, dayKey(new Date(), me.timezone), z.number().int().min(-24).max(0).parse(offset));
    const id = await generateReview({ workspaceId: me.workspaceId, timeZone: me.timezone, period: p, ...range });
    refresh();
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function regenerateReview(reviewId: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const [row] = await db
      .select({ period: review.period, start: review.periodStart, end: review.periodEnd })
      .from(review)
      .where(and(eq(review.id, z.uuid().parse(reviewId)), eq(review.workspaceId, me.workspaceId)));
    if (!row) throw new Error("Bilan introuvable.");
    await generateReview({ workspaceId: me.workspaceId, timeZone: me.timezone, period: row.period, start: row.start, end: row.end });
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

const weeklyInput = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  answers: z.object({
    proud: z.string().max(4000).default(""),
    blocked: z.string().max(4000).default(""),
    learned: z.string().max(4000).default(""),
    next: z.string().max(4000).default(""),
  }),
  priorityTaskIds: z.array(z.uuid()).max(5).default([]),
  newPriorities: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
});

/**
 * The guided weekly review: the owner's answers are saved with the week's numbers,
 * next week's priorities become high-priority tasks due by next Sunday, and the
 * narrative is written from both.
 */
export async function saveWeeklyReview(input: z.input<typeof weeklyInput>): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await getActionUser();
    const data = weeklyInput.parse(input);
    const range = periodRange("week", data.start);
    const nextSunday = zonedInstant(addDaysTo(range.end, 7), "18:00", me.timezone);

    if (data.priorityTaskIds.length) {
      await db
        .update(task)
        .set({ priority: "high", dueAt: nextSunday })
        .where(and(eq(task.workspaceId, me.workspaceId), inArray(task.id, data.priorityTaskIds), isNull(task.deletedAt)));
    }
    if (data.newPriorities.length) {
      await db
        .insert(task)
        .values(data.newPriorities.map((title) => ({ workspaceId: me.workspaceId, title, priority: "high" as const, dueAt: nextSunday })));
    }

    const answers = Object.fromEntries(Object.entries(data.answers).filter(([, value]) => value.trim()));
    const id = await generateReview({ workspaceId: me.workspaceId, timeZone: me.timezone, period: "week", ...range, answers });
    refresh();
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** A read-only link for the mentor. Only the hash is stored: the URL is shown once. */
export async function createShareLink(reviewId: string, days = 30): Promise<ActionResult<{ path: string }>> {
  try {
    const me = await getActionUser();
    const [row] = await db
      .select({ id: review.id })
      .from(review)
      .where(and(eq(review.id, z.uuid().parse(reviewId)), eq(review.workspaceId, me.workspaceId)));
    if (!row) throw new Error("Bilan introuvable.");
    const token = randomBytes(24).toString("base64url");
    await db.insert(shareLink).values({
      workspaceId: me.workspaceId,
      tokenHash: hashToken(token),
      kind: "review",
      targetId: row.id,
      expiresAt: new Date(Date.now() + z.number().int().min(1).max(365).parse(days) * 86400000),
    });
    refresh();
    return ok({ path: `/partage/${token}` });
  } catch (error) {
    return fail(error);
  }
}

export async function revokeShareLink(linkId: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await db
      .update(shareLink)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareLink.id, z.uuid().parse(linkId)), eq(shareLink.workspaceId, me.workspaceId)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
