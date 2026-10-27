import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/*
 * Domain schema. Rules that keep the data healthy for years:
 * - every row carries `workspaceId` (single owner today, multi-tenant ready);
 * - `occurredAt` (when it happened) is distinct from `createdAt` (when it was saved);
 * - user-facing rows are soft-deleted through `deletedAt`;
 * - enums are typed text columns so new values never need a type migration.
 * Embeddings arrive in phase 2 as their own table, decoupled from any one model.
 */

const id = () => uuid("id").primaryKey().defaultRandom();

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

/**
 * Full-text search column kept in sync by Postgres. Weight A (title) ranks above
 * B (body). cockpit_unaccent() comes from migration 0002.
 */
const searchVector = (titleColumn: string, bodyColumn: string) =>
  tsvector("search").generatedAlwaysAs(
    sql.raw(
      `setweight(to_tsvector('french'::regconfig, public.cockpit_unaccent(coalesce("${titleColumn}", ''))), 'A') || ` +
        `setweight(to_tsvector('french'::regconfig, public.cockpit_unaccent(coalesce("${bodyColumn}", ''))), 'B')`,
    ),
  );

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

const workspaceRef = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" });

// ---------------------------------------------------------------------------
// Workspace & projects
// ---------------------------------------------------------------------------

export const workspace = pgTable("workspace", {
  id: id(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("Europe/Paris"),
  ...timestamps,
});

export const project = pgTable(
  "project",
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    icon: text("icon").notNull().default("folder"),
    color: text("color").notNull().default("slate"),
    template: text("template", { enum: ["resale", "content", "business", "blank"] })
      .notNull()
      .default("blank"),
    status: text("status", { enum: ["active", "paused", "done", "archived"] })
      .notNull()
      .default("active"),
    position: integer("position").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("project_workspace_slug_idx").on(t.workspaceId, t.slug)],
);

// ---------------------------------------------------------------------------
// Contacts (personal CRM)
// ---------------------------------------------------------------------------

export const contact = pgTable(
  "contact",
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    role: text("role"),
    relationship: text("relationship", {
      enum: ["mentor", "client", "supplier", "partner", "other"],
    })
      .notNull()
      .default("other"),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    handles: jsonb("handles")
      .$type<{ instagram?: string; discord?: string; whatsapp?: string }>()
      .notNull()
      .default({}),
    notes: text("notes"),
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
    nextInteractionAt: timestamp("next_interaction_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("contact_workspace_idx").on(t.workspaceId)],
);

export const projectContact = pgTable(
  "project_contact",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.contactId] })],
);

// ---------------------------------------------------------------------------
// Entries: the universal object (notes, calls, messages, files, links…)
// ---------------------------------------------------------------------------

export const ENTRY_TYPES = [
  "note",
  "call",
  "message",
  "file",
  "link",
  "journal",
  "experiment",
  "decision",
  "review",
] as const;

export const ENTRY_SOURCES = [
  "manual",
  "share",
  "email",
  "discord",
  "instagram",
  "whatsapp",
  "upload",
  "meet",
  "import",
] as const;

export const entry = pgTable(
  "entry",
  {
    id: id(),
    workspaceId: workspaceRef(),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "set null" }),
    type: text("type", { enum: ENTRY_TYPES }).notNull().default("note"),
    title: text("title"),
    /** Editor document (block JSON). */
    content: jsonb("content"),
    /** Flattened text of `content`, used for search and AI context. */
    plainText: text("plain_text").notNull().default(""),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source", { enum: ENTRY_SOURCES }).notNull().default("manual"),
    /** Type-specific details: call duration, channel, URL, message author… */
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    /** Raw captures land in the inbox until triaged. */
    inboxStatus: text("inbox_status", { enum: ["inbox", "processed"] })
      .notNull()
      .default("inbox"),
    pinned: boolean("pinned").notNull().default(false),
    /** Private entries are never sent to an AI provider. */
    isPrivate: boolean("is_private").notNull().default(false),
    search: searchVector("title", "plain_text"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("entry_search_idx").using("gin", t.search),
    index("entry_workspace_occurred_idx").on(t.workspaceId, t.occurredAt.desc()),
    index("entry_project_occurred_idx").on(t.projectId, t.occurredAt.desc()),
    index("entry_inbox_idx")
      .on(t.workspaceId, t.inboxStatus)
      .where(sql`${t.deletedAt} is null`),
  ],
);

export const entryContact = pgTable(
  "entry_contact",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entry.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["author", "participant", "mentioned"] })
      .notNull()
      .default("participant"),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.contactId] })],
);

/** Backlinks between entries ([[note]] mentions). */
export const entryLink = pgTable(
  "entry_link",
  {
    fromEntryId: uuid("from_entry_id")
      .notNull()
      .references(() => entry.id, { onDelete: "cascade" }),
    toEntryId: uuid("to_entry_id")
      .notNull()
      .references(() => entry.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.fromEntryId, t.toEntryId] }),
    index("entry_link_to_idx").on(t.toEntryId),
  ],
);

export const attachment = pgTable(
  "attachment",
  {
    id: id(),
    workspaceId: workspaceRef(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entry.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    kind: text("kind", {
      enum: ["image", "pdf", "audio", "video", "spreadsheet", "document", "other"],
    }).notNull(),
    /** OCR, PDF text, or transcript: makes every file searchable. */
    extractedText: text("extracted_text"),
    processingStatus: text("processing_status", {
      enum: ["pending", "processing", "done", "failed"],
    })
      .notNull()
      .default("pending"),
    /** For call recordings: the other party agreed to be recorded. */
    recordingConsent: boolean("recording_consent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachment_entry_idx").on(t.entryId)],
);

// ---------------------------------------------------------------------------
// Insights: atomic knowledge extracted from entries, always tied to a source
// ---------------------------------------------------------------------------

export const insight = pgTable(
  "insight",
  {
    id: id(),
    workspaceId: workspaceRef(),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "set null" }),
    sourceEntryId: uuid("source_entry_id")
      .notNull()
      .references(() => entry.id, { onDelete: "cascade" }),
    /** Who said it (the mentor, a client…). Null when it is the owner's own thought. */
    contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
    type: text("type", {
      enum: ["advice", "decision", "action", "mistake", "lesson", "idea", "key_fact"],
    }).notNull(),
    content: text("content").notNull(),
    quote: text("quote"),
    /** Position in a call recording, in seconds. */
    sourceOffsetSec: integer("source_offset_sec"),
    status: text("status", { enum: ["proposed", "accepted", "applied", "dismissed"] })
      .notNull()
      .default("proposed"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    confidence: real("confidence"),
    ...timestamps,
  },
  (t) => [
    index("insight_workspace_type_idx").on(t.workspaceId, t.type, t.status),
    index("insight_contact_idx").on(t.contactId),
    index("insight_source_idx").on(t.sourceEntryId),
  ],
);

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const task = pgTable(
  "task",
  {
    id: id(),
    workspaceId: workspaceRef(),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: ["todo", "in_progress", "done", "cancelled"] })
      .notNull()
      .default("todo"),
    priority: text("priority", { enum: ["urgent", "high", "medium", "low", "none"] })
      .notNull()
      .default("none"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    estimateMinutes: integer("estimate_minutes"),
    actualMinutes: integer("actual_minutes"),
    /** Traceability: the call or note this task came from. */
    sourceEntryId: uuid("source_entry_id").references(() => entry.id, { onDelete: "set null" }),
    sourceInsightId: uuid("source_insight_id").references(() => insight.id, {
      onDelete: "set null",
    }),
    /** Accountability: promised to the mentor, a client… */
    promisedToContactId: uuid("promised_to_contact_id").references(() => contact.id, {
      onDelete: "set null",
    }),
    /** iCalendar RRULE for recurring tasks. */
    recurrence: text("recurrence"),
    position: integer("position").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    search: searchVector("title", "description"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("task_search_idx").using("gin", t.search),
    index("task_workspace_status_idx").on(t.workspaceId, t.status, t.dueAt),
    index("task_project_idx").on(t.projectId),
  ],
);

// ---------------------------------------------------------------------------
// Goals & KPIs: progress is computed from measurements, never declared
// ---------------------------------------------------------------------------

export const metric = pgTable(
  "metric",
  {
    id: id(),
    workspaceId: workspaceRef(),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Display unit: "€", "%", "abonnés"… */
    unit: text("unit"),
    direction: text("direction", { enum: ["up", "down"] }).notNull().default("up"),
    /** How values roll up over a period. */
    aggregation: text("aggregation", { enum: ["last", "sum", "avg"] })
      .notNull()
      .default("last"),
    position: integer("position").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("metric_project_idx").on(t.projectId)],
);

export const metricValue = pgTable(
  "metric_value",
  {
    id: id(),
    metricId: uuid("metric_id")
      .notNull()
      .references(() => metric.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    value: numeric("value", { precision: 14, scale: 2 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("metric_value_metric_date_idx").on(t.metricId, t.date)],
);

export const goal = pgTable(
  "goal",
  {
    id: id(),
    workspaceId: workspaceRef(),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    period: text("period", { enum: ["month", "quarter", "year", "custom"] })
      .notNull()
      .default("month"),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    /** `metric` goals track a KPI; `milestone` goals are done / not done. */
    kind: text("kind", { enum: ["metric", "milestone"] }).notNull().default("milestone"),
    metricId: uuid("metric_id").references(() => metric.id, { onDelete: "set null" }),
    startValue: numeric("start_value", { precision: 14, scale: 2 }),
    targetValue: numeric("target_value", { precision: 14, scale: 2 }),
    status: text("status", { enum: ["active", "achieved", "missed", "dropped"] })
      .notNull()
      .default("active"),
    ...timestamps,
  },
  (t) => [index("goal_workspace_period_idx").on(t.workspaceId, t.endsOn)],
);

// ---------------------------------------------------------------------------
// Resale module: per-item economics (answers "which products work best?")
// ---------------------------------------------------------------------------

export const inventoryItem = pgTable(
  "inventory_item",
  {
    id: id(),
    workspaceId: workspaceRef(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category"),
    brand: text("brand"),
    condition: text("condition"),
    /** Where it was bought. */
    sourcedFrom: text("sourced_from"),
    /** Where it is listed / sold: vinted, leboncoin… */
    platform: text("platform"),
    // Money is stored in cents to avoid floating point drift.
    buyPriceCents: integer("buy_price_cents").notNull(),
    sellPriceCents: integer("sell_price_cents"),
    feesCents: integer("fees_cents").notNull().default(0),
    status: text("status", { enum: ["sourced", "listed", "sold", "returned", "kept"] })
      .notNull()
      .default("sourced"),
    boughtOn: date("bought_on", { mode: "string" }),
    listedOn: date("listed_on", { mode: "string" }),
    soldOn: date("sold_on", { mode: "string" }),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("inventory_project_status_idx").on(t.projectId, t.status)],
);

// ---------------------------------------------------------------------------
// Reviews (daily journal → annual review)
// ---------------------------------------------------------------------------

export const review = pgTable(
  "review",
  {
    id: id(),
    workspaceId: workspaceRef(),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "cascade" }),
    period: text("period", { enum: ["day", "week", "month", "quarter", "year"] }).notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    content: jsonb("content"),
    summary: text("summary"),
    /** KPI values frozen at generation time, so old reviews stay truthful. */
    metricsSnapshot: jsonb("metrics_snapshot"),
    generatedBy: text("generated_by", { enum: ["user", "ai"] }).notNull().default("user"),
    ...timestamps,
  },
  // NULLS NOT DISTINCT: only one global (project-less) review per period.
  (t) => [
    unique("review_period_unique")
      .on(t.workspaceId, t.projectId, t.period, t.periodStart)
      .nullsNotDistinct(),
  ],
);

// ---------------------------------------------------------------------------
// Tags (controlled vocabulary), reminders
// ---------------------------------------------------------------------------

export const tag = pgTable(
  "tag",
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tag_workspace_name_idx").on(t.workspaceId, t.name)],
);

export const entryTag = pgTable(
  "entry_tag",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entry.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.tagId] })],
);

export const reminder = pgTable(
  "reminder",
  {
    id: id(),
    workspaceId: workspaceRef(),
    targetType: text("target_type", { enum: ["task", "goal", "call", "custom"] }).notNull(),
    targetId: uuid("target_id"),
    message: text("message"),
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    channel: text("channel", { enum: ["push", "email", "in_app"] }).notNull().default("in_app"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reminder_due_idx").on(t.remindAt).where(sql`${t.sentAt} is null`)],
);

// ---------------------------------------------------------------------------
// AI: conversations and a cost ledger (budget cap per month)
// ---------------------------------------------------------------------------

export const aiThread = pgTable("ai_thread", {
  id: id(),
  workspaceId: workspaceRef(),
  projectId: uuid("project_id").references(() => project.id, { onDelete: "set null" }),
  title: text("title"),
  ...timestamps,
});

export const aiMessage = pgTable(
  "ai_message",
  {
    id: id(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => aiThread.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "tool"] }).notNull(),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_message_thread_idx").on(t.threadId, t.createdAt)],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: id(),
    workspaceId: workspaceRef(),
    feature: text("feature", {
      enum: ["triage", "extract", "assistant", "review", "transcribe", "embed"],
    }).notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    /** Cost in millionths of a currency unit, to sum without float error. */
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_workspace_month_idx").on(t.workspaceId, t.createdAt)],
);
