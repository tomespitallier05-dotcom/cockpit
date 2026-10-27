import { InboxIcon } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <ModulePlaceholder
      icon={InboxIcon}
      title="Inbox"
      description="Tout ce que tu captures arrive ici, brut. L'IA propose un projet, un type et un contact ; tu valides en un geste."
      empty={{
        title: "Inbox vide",
        description: "Objectif : Inbox zéro en 2 minutes par jour. Capturer d'abord, classer ensuite.",
        phase: 1,
        features: [
          "Capture ⌘K, note vocale, partage depuis le téléphone",
          "Tri au clavier : J / K / Entrée",
          "Suggestions IA de projet, contact et tags (phase 2)",
          "Captures d'écran de DM lues par l'IA (phase 2)",
        ],
      }}
    />
  );
}
