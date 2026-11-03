import "server-only";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { aiUsage, workspace } from "../db/schema";
import { MEMBER_BUDGET_USD, MONTHLY_BUDGET_USD } from "./config";

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

/**
 * The first workspace (the deployment's owner) gets AI_MONTHLY_BUDGET_USD. Accounts created
 * through open sign-up use the same server API key, so they get AI_MEMBER_BUDGET_USD
 * instead (default 0: AI features stay off until you raise it).
 */
async function budgetFor(workspaceId: string) {
  const [first] = await db.select({ id: workspace.id }).from(workspace).orderBy(asc(workspace.createdAt)).limit(1);
  return first?.id === workspaceId ? MONTHLY_BUDGET_USD : MEMBER_BUDGET_USD;
}

/** Refuses new Claude calls once the month's budget is spent. */
export async function assertBudget(workspaceId: string) {
  const budget = await budgetFor(workspaceId);
  const { usd } = await monthSpend(workspaceId);
  if (usd >= budget) {
    throw new Error(
      budget > 0
        ? `Budget IA du mois atteint (${budget} $).`
        : "Les fonctions IA ne sont pas activées sur ce compte.",
    );
  }
}
