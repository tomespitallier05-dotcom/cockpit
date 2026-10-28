import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { requireUser } from "../dal";
import { db } from "../db";
import { contentItem, inventoryItem } from "../db/schema";

export type InventoryItemView = typeof inventoryItem.$inferSelect;
export type ContentItemView = typeof contentItem.$inferSelect;

export async function listInventory(projectId: string) {
  const me = await requireUser();
  return db
    .select()
    .from(inventoryItem)
    .where(and(eq(inventoryItem.workspaceId, me.workspaceId), eq(inventoryItem.projectId, projectId), isNull(inventoryItem.deletedAt)))
    .orderBy(desc(inventoryItem.createdAt));
}

export async function listContent(projectId: string) {
  const me = await requireUser();
  return db
    .select()
    .from(contentItem)
    .where(and(eq(contentItem.workspaceId, me.workspaceId), eq(contentItem.projectId, projectId), isNull(contentItem.deletedAt)))
    .orderBy(asc(contentItem.position), desc(contentItem.updatedAt));
}

/** Resale economics, shared by the inventory tab, analytics and the assistant. */
export function inventoryStats(items: InventoryItemView[], today = new Date()) {
  const sold = items.filter((i) => i.status === "sold" && i.sellPriceCents != null);
  const inStock = items.filter((i) => i.status === "sourced" || i.status === "listed");
  const profit = (i: InventoryItemView) => (i.sellPriceCents ?? 0) - i.buyPriceCents - i.feesCents;
  const days = (i: InventoryItemView) =>
    i.soldOn && i.boughtOn ? Math.max(0, Math.round((Date.parse(i.soldOn) - Date.parse(i.boughtOn)) / 86400000)) : null;
  const soldDays = sold.map(days).filter((d): d is number => d !== null);
  const totalProfit = sold.reduce((sum, i) => sum + profit(i), 0);
  const revenue = sold.reduce((sum, i) => sum + (i.sellPriceCents ?? 0), 0);
  const cost = sold.reduce((sum, i) => sum + i.buyPriceCents, 0);
  const dormant = inStock.filter((i) => {
    const since = i.listedOn ?? i.boughtOn;
    return since ? (today.getTime() - Date.parse(since)) / 86400000 > 30 : false;
  });

  const groupBy = (key: "category" | "brand" | "platform") => {
    const groups = new Map<string, InventoryItemView[]>();
    for (const item of sold) {
      const name = item[key]?.trim() || "Non renseigné";
      groups.set(name, [...(groups.get(name) ?? []), item]);
    }
    return [...groups.entries()]
      .map(([name, list]) => {
        const p = list.reduce((sum, i) => sum + profit(i), 0);
        const c = list.reduce((sum, i) => sum + i.buyPriceCents, 0);
        const d = list.map(days).filter((x): x is number => x !== null);
        return {
          name,
          count: list.length,
          profitCents: p,
          roi: c ? p / c : null,
          avgDays: d.length ? d.reduce((a, b) => a + b, 0) / d.length : null,
        };
      })
      .sort((a, b) => b.profitCents - a.profitCents);
  };

  return {
    count: items.length,
    soldCount: sold.length,
    stockCount: inStock.length,
    stockValueCents: inStock.reduce((sum, i) => sum + i.buyPriceCents, 0),
    revenueCents: revenue,
    profitCents: totalProfit,
    roi: cost ? totalProfit / cost : null,
    avgDaysToSell: soldDays.length ? soldDays.reduce((a, b) => a + b, 0) / soldDays.length : null,
    dormant: dormant.map((i) => ({ id: i.id, name: i.name, since: i.listedOn ?? i.boughtOn })),
    byCategory: groupBy("category"),
    byBrand: groupBy("brand"),
    byPlatform: groupBy("platform"),
  };
}

export type InventoryStats = ReturnType<typeof inventoryStats>;
