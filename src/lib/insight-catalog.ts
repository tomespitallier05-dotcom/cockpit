export const INSIGHT_TYPE_META = {
  advice: { label: "Conseil", plural: "Conseils", color: "#5b8cff" },
  decision: { label: "Décision", plural: "Décisions", color: "#9b7bff" },
  action: { label: "Action", plural: "Actions", color: "#e0a33b" },
  mistake: { label: "Erreur", plural: "Erreurs", color: "#f2555a" },
  lesson: { label: "Leçon", plural: "Leçons", color: "#3cc6b4" },
  idea: { label: "Idée", plural: "Idées", color: "#e5679a" },
  key_fact: { label: "Chiffre clé", plural: "Chiffres clés", color: "#9a9aa3" },
} as const;

export type InsightTypeKey = keyof typeof INSIGHT_TYPE_META;

export const INSIGHT_STATUS_LABELS = {
  proposed: "Proposé",
  accepted: "Retenu",
  applied: "Appliqué",
  dismissed: "Écarté",
} as const;

export type InsightStatusKey = keyof typeof INSIGHT_STATUS_LABELS;

export function insightTypeMeta(type: string) {
  return INSIGHT_TYPE_META[type as InsightTypeKey] ?? INSIGHT_TYPE_META.key_fact;
}

export type InsightView = {
  id: string;
  type: InsightTypeKey;
  status: InsightStatusKey;
  content: string;
  quote: string | null;
  contactId: string | null;
  contactName: string | null;
  sourceEntryId: string;
  sourceTitle: string | null;
  sourceDate: Date;
  projectName: string | null;
  createdAt: Date;
  appliedAt: Date | null;
  taskId: string | null;
  meta: { dueDate?: string | null; priority?: string };
};
