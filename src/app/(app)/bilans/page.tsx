import { CalendarRangeIcon } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Bilans" };

export default function ReviewsPage() {
  return (
    <ModulePlaceholder
      icon={CalendarRangeIcon}
      title="Bilans"
      description="Le rituel qui fait progresser : un journal du soir en 60 secondes, une revue hebdo guidée, et des bilans jusqu'à l'année."
      empty={{
        title: "Aucun bilan",
        description: "La revue hebdomadaire sera pré-remplie par l'IA : fait, pas fait, KPI, conseils en attente.",
        phase: 3,
        features: [
          "Journal du soir en 3 questions",
          "Revue hebdo guidée en 10 minutes",
          "Bilans mensuel, trimestriel, annuel",
          "Erreurs, réussites et recommandations IA",
        ],
      }}
    />
  );
}
