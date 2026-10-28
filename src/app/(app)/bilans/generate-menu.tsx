"use client";

import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Period } from "@/lib/periods";
import { generateReviewFor } from "@/server/actions/reviews";

const OPTIONS: { period: Period; offset: number; label: string }[] = [
  { period: "week", offset: -1, label: "Semaine dernière" },
  { period: "month", offset: 0, label: "Mois en cours" },
  { period: "month", offset: -1, label: "Mois dernier" },
  { period: "quarter", offset: -1, label: "Trimestre dernier" },
  { period: "year", offset: 0, label: "Année en cours" },
  { period: "year", offset: -1, label: "Année dernière" },
];

export function GenerateReviewMenu() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (period: Period, offset: number) =>
    startTransition(async () => {
      const result = await generateReviewFor(period, offset);
      if (!result.ok) return void toast.error(result.error);
      router.push(`/bilans/${result.data.id}`);
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {pending ? "Rédaction…" : "Générer un bilan"}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((option) => (
          <DropdownMenuItem key={`${option.period}${option.offset}`} onSelect={() => run(option.period, option.offset)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
