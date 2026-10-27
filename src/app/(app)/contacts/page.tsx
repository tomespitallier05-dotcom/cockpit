import { UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage() {
  return (
    <ModulePlaceholder
      icon={UsersIcon}
      title="Contacts"
      description="Ton CRM personnel : mentors, clients, fournisseurs et partenaires, avec tout ce qu'ils t'ont appris."
      empty={{
        title: "Aucun contact",
        description: "Commence par ton mentor : chaque conseil reçu sera relié à lui, avec son statut d'application.",
        phase: 1,
        features: [
          "Historique complet : appels, messages, notes",
          "Conseils reçus : nouveau, testé, appliqué",
          "Questions à poser au prochain appel",
          "Dernière et prochaine interaction",
        ],
      }}
    />
  );
}
