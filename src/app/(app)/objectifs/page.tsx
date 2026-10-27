import { GoalIcon } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Objectifs & KPI" };

export default function GoalsPage() {
  return (
    <ModulePlaceholder
      icon={GoalIcon}
      title="Objectifs & KPI"
      description="Des objectifs mesurables, reliés à tes indicateurs. La progression se calcule, elle ne se déclare pas."
      empty={{
        title: "Aucun indicateur suivi",
        description: "Sans chiffres, « analyse mon évolution » n'a pas de sens. Ce module en est la base.",
        phase: 3,
        features: [
          "3 à 5 KPI par projet : CA, marge, abonnés…",
          "Check-in hebdomadaire en 30 secondes",
          "Objectifs du mois, du trimestre, de l'année",
          "Progression calculée automatiquement",
        ],
      }}
    />
  );
}
