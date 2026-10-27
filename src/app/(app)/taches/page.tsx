import { ListTodoIcon } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Tâches" };

export default function TasksPage() {
  return (
    <ModulePlaceholder
      icon={ListTodoIcon}
      title="Tâches"
      description="Chaque tâche garde sa source : l'appel ou la note d'où elle vient, et la personne à qui tu l'as promise."
      empty={{
        title: "Aucune tâche",
        description: "Les actions décidées en appel deviendront des tâches proposées, que tu valides.",
        phase: 1,
        features: [
          "Vues Aujourd'hui, À venir, Par projet, Kanban",
          "Priorité, échéance, temps estimé et réel",
          "Tâches promises à un contact",
          "Tâches récurrentes",
        ],
      }}
    />
  );
}
