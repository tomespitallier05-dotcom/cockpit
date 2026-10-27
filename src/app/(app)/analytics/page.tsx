import { ChartNoAxesColumnIcon } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <ModulePlaceholder
      icon={ChartNoAxesColumnIcon}
      title="Analytics"
      description="Tes résultats et ton activité, semaine après semaine. Des résultats d'abord, de l'activité ensuite."
      empty={{
        title: "Pas encore de données",
        description: "Les graphiques se remplissent dès que tes KPI et tes tâches sont suivis.",
        phase: 3,
        features: [
          "Évolution hebdomadaire et mensuelle des KPI",
          "Temps investi par projet",
          "Objectifs atteints",
          "Activité comparée aux résultats",
        ],
      }}
    />
  );
}
