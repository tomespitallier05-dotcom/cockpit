import "server-only";
import { z } from "zod";
import { ENTRY_TYPES } from "../db/schema";
import { aiMock } from "./config";
import { generateStructured, imageBlock, textBlock } from "./claude";

export const INSIGHT_TYPES = ["advice", "decision", "action", "mistake", "lesson", "idea", "key_fact"] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

const insightSchema = z.object({
  type: z.enum(INSIGHT_TYPES),
  content: z.string().describe("Reformulation autonome et actionnable, en français, une phrase."),
  quote: z.string().nullable().describe("Les mots exacts de la source, ou null."),
  speaker: z.string().nullable().describe("Nom de la personne qui l'a dit, null si c'est le propriétaire."),
  dueDate: z.string().nullable().describe("Pour une action : échéance explicite au format AAAA-MM-JJ, sinon null."),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]),
  confidence: z.number().describe("Entre 0 et 1."),
});

const analysisSchema = z.object({
  title: z.string().describe("Titre court (moins de 70 caractères)."),
  summary: z.string().describe("Résumé en 1 à 3 phrases."),
  suggestedType: z.enum(ENTRY_TYPES),
  suggestedProjectId: z.string().nullable(),
  mentionedContactIds: z.array(z.string()),
  insights: z.array(insightSchema),
});

export type Analysis = z.infer<typeof analysisSchema>;
export type ExtractedInsight = z.infer<typeof insightSchema>;

type Option = { id: string; name: string; detail?: string | null };

const ANALYSIS_SYSTEM = `Tu analyses une entrée du journal de bord d'un entrepreneur francophone (notes, appels, messages, fichiers).
Ta tâche : en extraire les unités de connaissance atomiques, chacune reliée à sa source.

Types d'unités :
- advice : un conseil reçu (le plus souvent d'un mentor), formulé comme une recommandation à appliquer.
- decision : un choix arrêté.
- action : une chose concrète à faire (deviendra une tâche si l'utilisateur la valide).
- mistake : une erreur commise ou reconnue.
- lesson : un apprentissage tiré d'une expérience.
- idea : une idée à explorer.
- key_fact : un chiffre ou un fait clé (prix, résultat, délai, statistique).

Règles :
- N'invente rien : chaque unité doit être explicitement présente dans le texte. Mieux vaut zéro unité qu'une unité douteuse.
- Une unité = une idée. Reformule de façon autonome (compréhensible sans le contexte), en français, à l'infinitif pour les actions.
- quote reprend les mots exacts de la source quand c'est possible.
- speaker : le nom de la personne qui a dit ou recommandé la chose ; null pour les pensées du propriétaire du journal.
- suggestedProjectId et mentionedContactIds ne peuvent contenir que des identifiants des listes fournies.
- confidence reflète ta certitude que l'unité est bien dans le texte et correctement typée.`;

/** Insights, task proposals and triage suggestions for one entry. */
export async function analyzeEntry(input: {
  workspaceId: string;
  type: string;
  title: string | null;
  occurredAt: Date;
  text: string;
  projects: Option[];
  contacts: Option[];
}): Promise<Analysis> {
  if (aiMock()) return mockAnalysis(input);
  const context = [
    `Projets disponibles :\n${input.projects.map((p) => `- ${p.id} : ${p.name}${p.detail ? ` (${p.detail})` : ""}`).join("\n") || "(aucun)"}`,
    `Contacts disponibles :\n${input.contacts.map((c) => `- ${c.id} : ${c.name}${c.detail ? ` (${c.detail})` : ""}`).join("\n") || "(aucun)"}`,
  ].join("\n\n");
  return generateStructured({
    workspaceId: input.workspaceId,
    feature: "extract",
    schema: analysisSchema,
    system: ANALYSIS_SYSTEM,
    effort: "low",
    content: [
      textBlock(context),
      textBlock(
        `Entrée à analyser (type actuel : ${input.type}, date : ${input.occurredAt.toISOString().slice(0, 10)}).\n` +
          `Titre : ${input.title ?? "(sans titre)"}\n\n<entree>\n${input.text}\n</entree>`,
      ),
    ],
  });
}

const screenshotSchema = z.object({
  kind: z.enum(["conversation", "document", "photo"]),
  channel: z.enum(["instagram", "whatsapp", "discord", "sms", "email", "other"]).nullable(),
  participants: z.array(z.string()),
  transcript: z
    .string()
    .describe("Pour une conversation : une ligne par message, « Auteur : message ». Sinon : tout le texte lisible."),
  description: z.string().describe("Une phrase qui décrit l'image."),
});

export type ScreenshotReading = z.infer<typeof screenshotSchema>;

/** Reads a screenshot (DM, chat, document) into text the rest of the pipeline can use. */
export async function readImage(workspaceId: string, data: Uint8Array, mimeType: string): Promise<ScreenshotReading | null> {
  if (aiMock()) {
    return {
      kind: "conversation",
      channel: "instagram",
      participants: ["Karim"],
      transcript: "Karim : Je te conseille de poster tes reels le soir vers 19 h.\nMoi : Merci, je teste cette semaine.",
      description: "Capture d'écran simulée d'une conversation Instagram (AI_MOCK).",
    };
  }
  const image = imageBlock(data, mimeType);
  if (!image) return null;
  return generateStructured({
    workspaceId,
    feature: "vision",
    schema: screenshotSchema,
    effort: "low",
    system:
      "Tu lis des captures d'écran (messageries, réseaux sociaux, documents) pour les archiver dans un journal. Recopie fidèlement le texte, sans résumer ni inventer. Le propriétaire du journal est l'auteur des messages alignés à droite ou marqués comme envoyés ; nomme-le « Moi ».",
    content: [image, textBlock("Lis cette image et retranscris-la.")],
  });
}

// --- AI_MOCK: keyword heuristics that mimic the shape of a real answer --------

const MOCK_RULES: [InsightType, RegExp][] = [
  ["advice", /conseill|recommand|tu devrais|il faudrait que tu/i],
  ["decision", /j'ai décidé|décision|on part sur|je choisis/i],
  ["mistake", /erreur|j'aurais dû|raté|je n'aurais pas dû/i],
  ["lesson", /appris|leçon|retenir/i],
  ["idea", /idée|et si /i],
  ["action", /je dois|il faut|à faire|envoyer|relancer|préparer/i],
  ["key_fact", /\d+\s?(€|%|euros|abonnés|ventes)/i],
];

function mockAnalysis(input: { type: string; title: string | null; text: string; projects: Option[]; contacts: Option[] }): Analysis {
  const lower = input.text.toLowerCase();
  const sentences = input.text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 8);
  const insights: ExtractedInsight[] = [];
  for (const sentence of sentences) {
    const rule = MOCK_RULES.find(([, pattern]) => pattern.test(sentence));
    if (!rule) continue;
    const speaker = input.contacts.find((c) => sentence.toLowerCase().includes(c.name.split(" ")[0].toLowerCase()))?.name ?? null;
    insights.push({
      type: rule[0],
      content: sentence.replace(/^[-•]\s*/, ""),
      quote: sentence,
      speaker,
      dueDate: null,
      priority: rule[0] === "action" ? "medium" : "none",
      confidence: 0.6,
    });
  }
  const first = sentences[0] ?? input.title ?? "Entrée";
  return {
    title: input.title || first.slice(0, 60),
    summary: sentences.slice(0, 2).join(" ").slice(0, 280) || first,
    suggestedType: input.type as Analysis["suggestedType"],
    suggestedProjectId: input.projects.find((p) => lower.includes(p.name.toLowerCase()))?.id ?? null,
    mentionedContactIds: input.contacts.filter((c) => lower.includes(c.name.split(" ")[0].toLowerCase())).map((c) => c.id),
    insights: insights.slice(0, 12),
  };
}
