import { BotIcon } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage() {
  return (
    <ModulePlaceholder
      icon={BotIcon}
      title="Assistant"
      description="Pose une question sur tout ce que tu as capturé. Chaque réponse cite ses sources, et rien n'est modifié sans ta validation."
      empty={{
        title: "L'assistant arrive en phase 2",
        description: "Il s'appuiera sur tes notes, appels, messages et KPI : plus tu captures, plus il est utile.",
        phase: 2,
        features: [
          "« Que m'a conseillé mon mentor ces 30 derniers jours ? »",
          "« Quelles erreurs reviennent souvent ? »",
          "« Analyse mon évolution ce mois-ci »",
          "Claude par défaut, GPT et Gemini branchables",
        ],
      }}
    />
  );
}
