import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { contact, contentItem, entry, insight, inventoryItem, metric, metricValue, project, task } from "../db/schema";
import { claude, FALLBACK, trackUsage } from "./claude";
import { AI_MODEL, aiMock } from "./config";
import { retrieve, SourceRegistry, type Source } from "./retrieval";
import { assertBudget } from "./usage";

const SYSTEM = `Tu es l'assistant de Cockpit, le centre de contrôle personnel d'un entrepreneur francophone (achat-revente, création de contenu, business, accompagnement par un mentor).
Tu as accès à son journal (notes, appels, messages, fichiers), à ses tâches, à ses conseils et décisions extraits, à ses KPI, à son inventaire et à son pipeline de contenu, via les outils.

Règles :
- Réponds en français, en tutoyant, de façon directe et concise. Va à l'essentiel ; des listes courtes plutôt que de longs paragraphes.
- Chaque fait tiré du journal est suivi de sa source entre crochets, par exemple [2]. N'utilise que les numéros fournis par les sources ou les outils.
- Si l'information n'existe pas dans les données, dis-le clairement plutôt que de supposer.
- Pour analyser une évolution ou des résultats, appuie-toi sur les chiffres (KPI, tâches terminées, inventaire), pas sur des impressions.
- Tu proposes, l'utilisateur décide : ne prétends jamais avoir modifié quoi que ce soit.`;

export type AssistantEvent =
  | { t: "text"; d: string }
  | { t: "status"; d: string }
  | { t: "sources"; d: Source[] }
  | { t: "error"; d: string };

type Turn = { role: "user" | "assistant"; text: string };

function euros(cents: number) {
  return `${(cents / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
}

async function projectIdByName(workspaceId: string, name?: string | null) {
  if (!name) return null;
  const rows = await db
    .select({ id: project.id, name: project.name })
    .from(project)
    .where(and(eq(project.workspaceId, workspaceId), isNull(project.deletedAt)));
  const target = name.toLowerCase();
  return rows.find((p) => p.name.toLowerCase() === target)?.id ?? rows.find((p) => p.name.toLowerCase().includes(target))?.id ?? null;
}

function buildTools(workspaceId: string, registry: SourceRegistry, emit: (event: AssistantEvent) => void) {
  return [
    betaZodTool({
      name: "rechercher_journal",
      description:
        "Recherche dans le journal (notes, appels, messages, transcriptions) par mots-clés et par sens. Renvoie des extraits numérotés à citer.",
      inputSchema: z.object({ requete: z.string().describe("Ce qu'il faut chercher, en langage naturel.") }),
      run: async ({ requete }) => {
        emit({ t: "status", d: `Recherche « ${requete} »…` });
        return registry.format(registry.add(await retrieve(workspaceId, requete, 6)));
      },
    }),
    betaZodTool({
      name: "lister_taches",
      description: "Liste les tâches : en retard, du jour, ouvertes, ou terminées ces 7 derniers jours.",
      inputSchema: z.object({
        filtre: z.enum(["en_retard", "aujourdhui", "ouvertes", "terminees_7_jours"]),
        projet: z.string().nullable().describe("Nom du projet, ou null pour tous."),
      }),
      run: async ({ filtre, projet }) => {
        emit({ t: "status", d: "Lecture des tâches…" });
        const projectId = await projectIdByName(workspaceId, projet);
        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        const where = [eq(task.workspaceId, workspaceId), isNull(task.deletedAt)];
        if (projectId) where.push(eq(task.projectId, projectId));
        if (filtre === "terminees_7_jours") {
          where.push(eq(task.status, "done"), gte(task.completedAt, new Date(now.getTime() - 7 * 86400000)));
        } else {
          where.push(inArray(task.status, ["todo", "in_progress"]));
          if (filtre === "en_retard") where.push(lt(task.dueAt, now));
          if (filtre === "aujourdhui") where.push(lt(task.dueAt, endOfDay));
        }
        const rows = await db
          .select({ title: task.title, status: task.status, priority: task.priority, dueAt: task.dueAt, projectName: project.name, promisedTo: contact.name })
          .from(task)
          .leftJoin(project, eq(project.id, task.projectId))
          .leftJoin(contact, eq(contact.id, task.promisedToContactId))
          .where(and(...where))
          .orderBy(asc(task.dueAt))
          .limit(40);
        if (rows.length === 0) return "Aucune tâche.";
        return rows
          .map((r) => `- ${r.title} (${r.status}, priorité ${r.priority}${r.dueAt ? `, échéance ${r.dueAt.toISOString().slice(0, 10)}` : ""}${r.projectName ? `, ${r.projectName}` : ""}${r.promisedTo ? `, promise à ${r.promisedTo}` : ""})`)
          .join("\n");
      },
    }),
    betaZodTool({
      name: "lister_connaissances",
      description:
        "Liste les conseils, décisions, erreurs, leçons, idées, actions ou chiffres clés extraits du journal, avec leur source numérotée.",
      inputSchema: z.object({
        type: z.enum(["advice", "decision", "action", "mistake", "lesson", "idea", "key_fact"]),
        contact: z.string().nullable().describe("Nom de la personne qui l'a dit (ex. le mentor), ou null."),
        jours: z.number().nullable().describe("Limiter aux N derniers jours, ou null."),
      }),
      run: async ({ type, contact: contactName, jours }) => {
        emit({ t: "status", d: "Lecture des connaissances…" });
        const where = [eq(insight.workspaceId, workspaceId), eq(insight.type, type), inArray(insight.status, ["proposed", "accepted", "applied"]), isNull(entry.deletedAt), eq(entry.isPrivate, false)];
        if (jours) where.push(gte(entry.occurredAt, new Date(Date.now() - jours * 86400000)));
        if (contactName) where.push(sql`lower(${contact.name}) like ${`%${contactName.toLowerCase()}%`}`);
        const rows = await db
          .select({
            content: insight.content,
            status: insight.status,
            entryId: entry.id,
            title: entry.title,
            plainText: entry.plainText,
            occurredAt: entry.occurredAt,
            projectName: project.name,
            who: contact.name,
          })
          .from(insight)
          .innerJoin(entry, eq(entry.id, insight.sourceEntryId))
          .leftJoin(contact, eq(contact.id, insight.contactId))
          .leftJoin(project, eq(project.id, insight.projectId))
          .where(and(...where))
          .orderBy(desc(entry.occurredAt))
          .limit(40);
        if (rows.length === 0) return "Rien trouvé.";
        const sources = registry.add(
          rows.map((r) => ({
            entryId: r.entryId,
            title: r.title || "Sans titre",
            date: r.occurredAt.toISOString().slice(0, 10),
            projectName: r.projectName,
            excerpt: r.plainText.slice(0, 600),
          })),
        );
        return rows
          .map((r, i) => `- ${r.content} (statut ${r.status}${r.who ? `, dit par ${r.who}` : ""}, ${r.occurredAt.toISOString().slice(0, 10)}) [${sources[i].n}]`)
          .join("\n");
      },
    }),
    betaZodTool({
      name: "indicateurs",
      description: "KPI suivis (par projet) avec leurs dernières valeurs datées, pour analyser une évolution.",
      inputSchema: z.object({ projet: z.string().nullable() }),
      run: async ({ projet }) => {
        emit({ t: "status", d: "Lecture des KPI…" });
        const projectId = await projectIdByName(workspaceId, projet);
        const metrics = await db
          .select({ id: metric.id, name: metric.name, unit: metric.unit, projectName: project.name })
          .from(metric)
          .leftJoin(project, eq(project.id, metric.projectId))
          .where(and(eq(metric.workspaceId, workspaceId), isNull(metric.archivedAt), projectId ? eq(metric.projectId, projectId) : undefined));
        if (metrics.length === 0) return "Aucun KPI suivi.";
        const values = await db
          .select({ metricId: metricValue.metricId, date: metricValue.date, value: metricValue.value })
          .from(metricValue)
          .where(inArray(metricValue.metricId, metrics.map((m) => m.id)))
          .orderBy(desc(metricValue.date))
          .limit(400);
        return metrics
          .map((m) => {
            const series = values.filter((v) => v.metricId === m.id).slice(0, 12).reverse();
            return `${m.name}${m.unit ? ` (${m.unit})` : ""}${m.projectName ? ` — ${m.projectName}` : ""} : ${series.map((v) => `${v.date} = ${v.value}`).join(", ") || "aucune valeur"}`;
          })
          .join("\n");
      },
    }),
    betaZodTool({
      name: "inventaire",
      description: "Économie de l'achat-revente : articles, marges, délais de vente, par catégorie, marque et plateforme.",
      inputSchema: z.object({ projet: z.string().nullable() }),
      run: async ({ projet }) => {
        emit({ t: "status", d: "Lecture de l'inventaire…" });
        const projectId = await projectIdByName(workspaceId, projet);
        const rows = await db
          .select()
          .from(inventoryItem)
          .where(and(eq(inventoryItem.workspaceId, workspaceId), isNull(inventoryItem.deletedAt), projectId ? eq(inventoryItem.projectId, projectId) : undefined))
          .orderBy(desc(inventoryItem.createdAt))
          .limit(300);
        if (rows.length === 0) return "Inventaire vide.";
        return rows
          .map((r) => {
            const margin = r.sellPriceCents != null ? r.sellPriceCents - r.buyPriceCents - r.feesCents : null;
            const days = r.soldOn && r.boughtOn ? Math.round((Date.parse(r.soldOn) - Date.parse(r.boughtOn)) / 86400000) : null;
            return `- ${r.name} [${r.status}] cat. ${r.category ?? "?"}, marque ${r.brand ?? "?"}, plateforme ${r.platform ?? "?"} : achat ${euros(r.buyPriceCents)}${r.sellPriceCents != null ? `, vente ${euros(r.sellPriceCents)}` : ""}${margin != null ? `, marge ${euros(margin)}` : ""}${days != null ? `, vendu en ${days} j` : ""}`;
          })
          .join("\n");
      },
    }),
    betaZodTool({
      name: "contenus",
      description: "Pipeline de contenu : idées, en cours, publiés, avec les statistiques des publications.",
      inputSchema: z.object({ projet: z.string().nullable() }),
      run: async ({ projet }) => {
        emit({ t: "status", d: "Lecture des contenus…" });
        const projectId = await projectIdByName(workspaceId, projet);
        const rows = await db
          .select()
          .from(contentItem)
          .where(and(eq(contentItem.workspaceId, workspaceId), isNull(contentItem.deletedAt), projectId ? eq(contentItem.projectId, projectId) : undefined))
          .orderBy(desc(contentItem.updatedAt))
          .limit(200);
        if (rows.length === 0) return "Aucun contenu.";
        return rows
          .map((r) => `- ${r.title} [${r.format}, ${r.stage}]${r.publishedOn ? ` publié le ${r.publishedOn}` : ""}${r.hook ? `, accroche « ${r.hook} »` : ""} ${JSON.stringify(r.stats)}`)
          .join("\n");
      },
    }),
  ];
}

/**
 * One assistant turn: retrieval first (so simple questions need no tool call),
 * then Claude with read-only tools, streamed to the caller as events.
 */
export async function runAssistant(options: {
  workspaceId: string;
  timezone: string;
  history: Turn[];
  question: string;
  emit: (event: AssistantEvent) => void;
}) {
  const registry = new SourceRegistry();
  const initial = registry.add(await retrieve(options.workspaceId, options.question, 8));
  const today = new Date().toLocaleDateString("fr-FR", { timeZone: options.timezone, weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (aiMock()) {
    const text = initial.length
      ? `Voici ce que je retrouve dans ton journal (réponse simulée, AI_MOCK) :\n\n${initial
          .slice(0, 3)
          .map((s) => `- ${s.title} : ${s.excerpt.slice(0, 140).replace(/\s+/g, " ")} [${s.n}]`)
          .join("\n")}`
      : "Je ne trouve rien à ce sujet dans ton journal (réponse simulée, AI_MOCK).";
    for (const word of text.split(/(?<= )/)) options.emit({ t: "text", d: word });
    return { text, sources: registry.cited(text) };
  }

  await assertBudget(options.workspaceId);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...options.history.map((turn) => ({ role: turn.role, content: turn.text })),
    {
      role: "user",
      content: `Nous sommes le ${today}.\n\nSources trouvées pour cette question :\n\n${registry.format(initial)}\n\nQuestion : ${options.question}`,
    },
  ];

  const runner = claude().beta.messages.toolRunner({
    model: AI_MODEL,
    max_tokens: 64000,
    ...FALLBACK,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "medium" },
    tools: buildTools(options.workspaceId, registry, options.emit),
    messages,
    max_iterations: 8,
    stream: true,
  });

  let text = "";
  for await (const stream of runner) {
    stream.on("text", (delta) => {
      text += delta;
      options.emit({ t: "text", d: delta });
    });
    const message = await stream.finalMessage();
    await trackUsage(options.workspaceId, "assistant", message);
    if (message.stop_reason === "refusal") {
      options.emit({ t: "error", d: "L'assistant a refusé de répondre à cette demande." });
      break;
    }
    if (message.stop_reason === "pause_turn") {
      runner.pushMessages({ role: "assistant", content: message.content });
    }
  }
  return { text: text.trim(), sources: registry.cited(text) };
}
