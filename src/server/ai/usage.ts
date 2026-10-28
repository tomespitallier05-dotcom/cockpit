import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { aiUsage } from "../db/schema";
import { MONTHLY_BUDGET_USD } from "./config";

type Feature = (typeof aiUsage.$inferInsert)["feature"];

export async function recordUsage(input: {
  workspaceId: string;
  feature: Feature;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  costMicros?: number;
}) {
  await db.insert(aiUsage).values({
    workspaceId: input.workspaceId,
    feature: input.feature,
    provider: input.provider,
    model: input.model,
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
    costMicros: input.costMicros ?? 0,
  });
}

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function monthSpend(workspaceId: string) {
  const [row] = await db
    .select({
      micros: sql<string>`coalesce(sum(${aiUsage.costMicros}), 0)`,
      calls: sql<string>`count(*)`,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.workspaceId, workspaceId), gte(aiUsage.createdAt, monthStart())));
  return { usd: Number(row?.micros ?? 0) / 1_000_000, calls: Number(row?.calls ?? 0) };
}

/** Refuses new Claude calls once the month's budget is spent. */
export async function assertBudget(workspaceId: string) {
  const { usd } = await monthSpend(workspaceId);
  if (usd >= MONTHLY_BUDGET_USD) {
    throw new Error(`Budget IA du mois atteint (${MONTHLY_BUDGET_USD} $). Modifie AI_MONTHLY_BUDGET_USD pour l'augmenter.`);
  }
}
