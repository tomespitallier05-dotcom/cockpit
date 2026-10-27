// Entry types offered in the UI (phase 1). `experiment`, `decision` and `review`
// exist in the schema and arrive with phases 3 and 4.

export const CAPTURE_TYPES = ["note", "call", "message", "link", "file", "journal"] as const;
export type CaptureType = (typeof CAPTURE_TYPES)[number];

export const ENTRY_TYPE_META: Record<
  CaptureType,
  { label: string; plural: string; color: string; placeholder: string }
> = {
  note: { label: "Note", plural: "Notes", color: "#9a9aa3", placeholder: "Une idée, un compte rendu, une réflexion…" },
  call: { label: "Appel", plural: "Appels", color: "#5b8cff", placeholder: "Ce qui s'est dit, les décisions, les actions…" },
  message: { label: "Message", plural: "Messages", color: "#9b7bff", placeholder: "Colle le message ou résume-le…" },
  link: { label: "Lien", plural: "Liens", color: "#3cc6b4", placeholder: "Pourquoi ce lien est important…" },
  file: { label: "Fichier", plural: "Fichiers", color: "#e0a33b", placeholder: "Ce que contient ce fichier…" },
  journal: { label: "Journal", plural: "Journal", color: "#e5679a", placeholder: "Ce qui a marché, ce qui a bloqué, ce que tu retiens…" },
};

export function entryTypeMeta(type: string) {
  return ENTRY_TYPE_META[type as CaptureType] ?? ENTRY_TYPE_META.note;
}

export const MESSAGE_CHANNELS = {
  discord: "Discord",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
  other: "Autre",
} as const;
export type MessageChannel = keyof typeof MESSAGE_CHANNELS;

/** Type-specific fields stored in `entry.meta`. */
export type EntryMeta = {
  durationMinutes?: number;
  channel?: MessageChannel;
  url?: string;
};

export const CONTACT_RELATIONSHIPS = {
  mentor: "Mentor",
  client: "Client",
  supplier: "Fournisseur",
  partner: "Partenaire",
  other: "Autre",
} as const;
export type ContactRelationship = keyof typeof CONTACT_RELATIONSHIPS;

export const TASK_PRIORITIES = {
  urgent: { label: "Urgente", color: "#f2555a", rank: 0 },
  high: { label: "Haute", color: "#e8794a", rank: 1 },
  medium: { label: "Moyenne", color: "#e0a33b", rank: 2 },
  low: { label: "Basse", color: "#5b8cff", rank: 3 },
  none: { label: "Aucune", color: "#6b6b74", rank: 4 },
} as const;
export type TaskPriority = keyof typeof TASK_PRIORITIES;

export const TASK_STATUSES = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminée",
  cancelled: "Annulée",
} as const;
export type TaskStatus = keyof typeof TASK_STATUSES;

/** Turns plain text into a minimal editor document, one paragraph per line. */
export function textToDoc(text: string) {
  const lines = text.split(/\r?\n/);
  return {
    type: "doc",
    content: lines.map((line) =>
      line.trim() ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" },
    ),
  };
}
