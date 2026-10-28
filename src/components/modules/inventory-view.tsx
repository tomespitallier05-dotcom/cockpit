"use client";

import { AlertTriangleIcon, Loader2Icon, PackagePlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { CardEmpty } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteInventoryItem, saveInventoryItem } from "@/server/actions/modules";

export type InventoryItem = {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  condition: string | null;
  sourcedFrom: string | null;
  platform: string | null;
  buyPriceCents: number;
  sellPriceCents: number | null;
  feesCents: number;
  status: "sourced" | "listed" | "sold" | "returned" | "kept";
  boughtOn: string | null;
  listedOn: string | null;
  soldOn: string | null;
  notes: string | null;
};

type Group = { name: string; count: number; profitCents: number; roi: number | null; avgDays: number | null };
type Stats = {
  soldCount: number;
  stockCount: number;
  stockValueCents: number;
  revenueCents: number;
  profitCents: number;
  roi: number | null;
  avgDaysToSell: number | null;
  dormant: { id: string; name: string; since: string | null }[];
  byCategory: Group[];
  byBrand: Group[];
  byPlatform: Group[];
};

const STATUSES = {
  sourced: "Acheté",
  listed: "En vente",
  sold: "Vendu",
  returned: "Retourné",
  kept: "Gardé",
} as const;

function euros(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
}

function toCents(value: string) {
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function InventoryView({ projectId, items, stats, today }: { projectId: string; items: InventoryItem[]; stats: Stats; today: string }) {
  const [editing, setEditing] = useState<InventoryItem | "new" | null>(null);
  const [filter, setFilter] = useState<"all" | "stock" | "sold">("all");
  const [groupKey, setGroupKey] = useState<"byCategory" | "byBrand" | "byPlatform">("byCategory");
  const visible = items.filter((i) =>
    filter === "all" ? true : filter === "sold" ? i.status === "sold" : i.status === "sourced" || i.status === "listed",
  );
  const groups = stats[groupKey];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Bénéfice net" value={euros(stats.profitCents)} hint={`${stats.soldCount} vente${stats.soldCount > 1 ? "s" : ""}`} />
        <Tile label="Retour sur achat" value={stats.roi === null ? "—" : `${Math.round(stats.roi * 100)} %`} hint={`CA ${euros(stats.revenueCents)}`} />
        <Tile
          label="Délai de vente moyen"
          value={stats.avgDaysToSell === null ? "—" : `${Math.round(stats.avgDaysToSell)} j`}
          hint="De l'achat à la vente"
        />
        <Tile label="Stock" value={euros(stats.stockValueCents)} hint={`${stats.stockCount} article${stats.stockCount > 1 ? "s" : ""} au prix d'achat`} />
      </div>

      {stats.dormant.length ? (
        <p className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/8 px-4 py-3 text-[13px] text-muted-foreground">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            <span className="font-medium text-foreground">Stock dormant :</span>{" "}
            {stats.dormant.slice(0, 4).map((d) => d.name).join(", ")}
            {stats.dormant.length > 4 ? ` et ${stats.dormant.length - 4} autre(s)` : ""} : plus de 30 jours sans vente. Baisse le prix ou change de plateforme.
          </span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {(["all", "stock", "sold"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[12.5px] transition-colors",
                filter === key ? "bg-white/[0.07] text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {key === "all" ? "Tout" : key === "stock" ? "En stock" : "Vendus"}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <PackagePlusIcon /> Ajouter un article
        </Button>
      </div>

      {visible.length ? (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11.5px] text-subtle">
                <th className="px-4 py-2 font-normal">Article</th>
                <th className="px-2 py-2 font-normal">Statut</th>
                <th className="px-2 py-2 text-right font-normal">Achat</th>
                <th className="px-2 py-2 text-right font-normal">Vente</th>
                <th className="px-2 py-2 text-right font-normal">Marge</th>
                <th className="px-4 py-2 text-right font-normal">Délai</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {visible.map((item) => {
                const margin = item.sellPriceCents != null ? item.sellPriceCents - item.buyPriceCents - item.feesCents : null;
                const days =
                  item.soldOn && item.boughtOn ? Math.round((Date.parse(item.soldOn) - Date.parse(item.boughtOn)) / 86400000) : null;
                return (
                  <tr key={item.id} onClick={() => setEditing(item)} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-white/[0.025]">
                    <td className="px-4 py-2.5">
                      <span className="block text-foreground">{item.name}</span>
                      <span className="block text-[11.5px] text-subtle">
                        {[item.brand, item.category, item.platform].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-muted-foreground">{STATUSES[item.status]}</td>
                    <td className="px-2 py-2.5 text-right text-muted-foreground">{euros(item.buyPriceCents)}</td>
                    <td className="px-2 py-2.5 text-right text-muted-foreground">{euros(item.sellPriceCents)}</td>
                    <td className={cn("px-2 py-2.5 text-right", margin === null ? "text-subtle" : margin >= 0 ? "text-success" : "text-destructive")}>
                      {margin === null ? "—" : `${margin > 0 ? "+" : ""}${euros(margin)}`}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{days === null ? "—" : `${days} j`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <CardEmpty>
          Ajoute chaque article acheté avec son prix : en le marquant vendu, tu sauras ce qui rapporte vraiment, et en combien de temps.
        </CardEmpty>
      )}

      {stats.soldCount ? (
        <section className="surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13.5px] font-medium text-foreground">Ce qui rapporte le plus</h3>
            <div className="flex gap-1">
              {(
                [
                  ["byCategory", "Catégorie"],
                  ["byBrand", "Marque"],
                  ["byPlatform", "Plateforme"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGroupKey(key)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[12px] transition-colors",
                    groupKey === key ? "bg-white/[0.07] text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <table className="mt-3 w-full text-[13px] tabular-nums">
            <thead>
              <tr className="text-left text-[11.5px] text-subtle">
                <th className="py-1.5 font-normal">Groupe</th>
                <th className="py-1.5 text-right font-normal">Ventes</th>
                <th className="py-1.5 text-right font-normal">Bénéfice</th>
                <th className="py-1.5 text-right font-normal">ROI</th>
                <th className="py-1.5 text-right font-normal">Délai</th>
              </tr>
            </thead>
            <tbody>
              {groups.slice(0, 8).map((group) => (
                <tr key={group.name} className="border-t border-border/60">
                  <td className="py-2 text-foreground">{group.name}</td>
                  <td className="py-2 text-right text-muted-foreground">{group.count}</td>
                  <td className="py-2 text-right text-foreground">{euros(group.profitCents)}</td>
                  <td className="py-2 text-right text-muted-foreground">{group.roi === null ? "—" : `${Math.round(group.roi * 100)} %`}</td>
                  <td className="py-2 text-right text-muted-foreground">{group.avgDays === null ? "—" : `${Math.round(group.avgDays)} j`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {editing ? (
        <ItemDialog projectId={projectId} item={editing === "new" ? null : editing} today={today} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="surface px-4 py-3.5">
      <p className="text-[12px] text-subtle">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-[11.5px] text-subtle">{hint}</p>
    </div>
  );
}

function ItemDialog({ projectId, item, today, onClose }: { projectId: string; item: InventoryItem | null; today: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: item?.name ?? "",
    category: item?.category ?? "",
    brand: item?.brand ?? "",
    condition: item?.condition ?? "",
    sourcedFrom: item?.sourcedFrom ?? "",
    platform: item?.platform ?? "",
    buy: item ? String(item.buyPriceCents / 100).replace(".", ",") : "",
    sell: item?.sellPriceCents != null ? String(item.sellPriceCents / 100).replace(".", ",") : "",
    fees: item ? String(item.feesCents / 100).replace(".", ",") : "0",
    status: item?.status ?? ("sourced" as InventoryItem["status"]),
    boughtOn: item?.boughtOn ?? today,
    listedOn: item?.listedOn ?? "",
    soldOn: item?.soldOn ?? "",
    notes: item?.notes ?? "",
  });
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const save = () =>
    startTransition(async () => {
      const buy = toCents(form.buy || "0");
      const sell = form.sell.trim() ? toCents(form.sell) : null;
      const fees = toCents(form.fees || "0");
      if ([buy, fees, sell ?? 0].some((n) => Number.isNaN(n) || n < 0)) return void toast.error("Un montant n'est pas valide.");
      const result = await saveInventoryItem(item?.id ?? null, {
        projectId,
        name: form.name,
        category: form.category,
        brand: form.brand,
        condition: form.condition,
        sourcedFrom: form.sourcedFrom,
        platform: form.platform,
        buyPriceCents: buy,
        sellPriceCents: sell,
        feesCents: fees,
        status: form.status,
        boughtOn: form.boughtOn || null,
        listedOn: form.listedOn || null,
        soldOn: form.soldOn || null,
        notes: form.notes,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(item ? "Article mis à jour" : "Article ajouté");
      router.refresh();
      onClose();
    });

  const remove = () =>
    startTransition(async () => {
      if (!item) return;
      const result = await deleteInventoryItem(item.id);
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
      onClose();
    });

  const field = (key: keyof typeof form, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <label className="grid gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <Input value={form[key] as string} onChange={(event) => set({ [key]: event.target.value } as Partial<typeof form>)} {...props} />
    </label>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? item.name : "Nouvel article"}</DialogTitle>
          <DialogDescription>Montants en euros. La marge déduit le prix d&apos;achat et les frais (commission, envoi).</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3 text-[13px]"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          {field("name", "Article", { autoFocus: !item, placeholder: "Veste Carhartt Detroit" })}
          <div className="grid grid-cols-3 gap-3">
            {field("brand", "Marque")}
            {field("category", "Catégorie")}
            {field("condition", "État")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("sourcedFrom", "Acheté où")}
            {field("platform", "Vendu sur", { placeholder: "Vinted, Leboncoin…" })}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {field("buy", "Prix d'achat", { inputMode: "decimal" })}
            {field("sell", "Prix de vente", { inputMode: "decimal" })}
            {field("fees", "Frais", { inputMode: "decimal" })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <span className="text-muted-foreground">Statut</span>
              <Select value={form.status} onValueChange={(value) => set({ status: value as InventoryItem["status"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUSES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("boughtOn", "Acheté le", { type: "date" })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("listedOn", "Mis en vente le", { type: "date" })}
            {field("soldOn", "Vendu le", { type: "date" })}
          </div>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground">Notes</span>
            <Textarea value={form.notes} onChange={(event) => set({ notes: event.target.value })} rows={2} />
          </label>
          <DialogFooter className="sm:justify-between">
            {item ? (
              <Button type="button" variant="ghost" onClick={remove} disabled={pending}>
                <Trash2Icon /> Supprimer
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending || !form.name.trim()}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
