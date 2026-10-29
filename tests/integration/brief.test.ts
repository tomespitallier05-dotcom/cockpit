// Integration tests for the morning brief (src/server/ai/brief.ts) on a REAL Postgres,
// through postgres.js exactly like production. PGlite would hide the class of bug this
// guards against: postgres.js refuses a raw Date inside a sql`` template, PGlite does not.
//
//   npm run test:db:up && npm run test:db:reset && npm run test:integration
import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { testDatabaseUrl } from "../test-env.mjs";

// Fixed "now": Tuesday 2026-03-10, 11:00 in Paris (10:00 UTC), far from any DST change
// and from midnight, so "today", "yesterday" and "later today" are unambiguous.
const NOW = new Date("2026-03-10T10:00:00Z");
const at = (iso: string) => new Date(iso);

type Db = typeof import("@/server/db").db;
let db: Db;
let schema: typeof import("@/server/db/schema");
let buildBrief: typeof import("@/server/ai/brief").buildBrief;
let getBrief: typeof import("@/server/ai/brief").getBrief;

const ids = { user: "user-brief-test", other: "user-brief-other", workspace: "", otherWorkspace: "" };

async function seed() {
  const { user, workspace, task, entry, insight, contact } = schema;
  await db.insert(user).values([
    { id: ids.user, name: "Tom Test", email: "tom@test.local" },
    { id: ids.other, name: "Autre Test", email: "autre@test.local" },
  ]);
  const [space, otherSpace] = await db
    .insert(workspace)
    .values([
      { name: "Espace de Tom", ownerId: ids.user, timezone: "Europe/Paris" },
      { name: "Autre espace", ownerId: ids.other, timezone: "Europe/Paris" },
    ])
    .returning({ id: workspace.id });
  ids.workspace = space.id;
  ids.otherWorkspace = otherSpace.id;

  await db.insert(task).values([
    // Open tasks due by the end of today: 1 overdue + 1 due today.
    { workspaceId: ids.workspace, title: "En retard", status: "todo", priority: "high", dueAt: at("2026-03-09T09:00:00Z") },
    { workspaceId: ids.workspace, title: "Pour aujourd'hui", status: "in_progress", priority: "urgent", dueAt: at("2026-03-10T14:00:00Z") },
    // Must not be counted as open today.
    { workspaceId: ids.workspace, title: "Demain", status: "todo", dueAt: at("2026-03-11T09:00:00Z") },
    { workspaceId: ids.workspace, title: "Sans échéance", status: "todo" },
    { workspaceId: ids.workspace, title: "Supprimée", status: "todo", dueAt: at("2026-03-09T09:00:00Z"), deletedAt: at("2026-03-09T10:00:00Z") },
    // Done: yesterday counts, the day before does not.
    { workspaceId: ids.workspace, title: "Finie hier", status: "done", completedAt: at("2026-03-09T12:00:00Z") },
    { workspaceId: ids.workspace, title: "Finie avant-hier", status: "done", completedAt: at("2026-03-08T12:00:00Z") },
    // Another workspace must never leak into this brief.
    { workspaceId: ids.otherWorkspace, title: "Autre espace, en retard", status: "todo", dueAt: at("2026-03-09T09:00:00Z") },
    { workspaceId: ids.otherWorkspace, title: "Autre espace, finie hier", status: "done", completedAt: at("2026-03-09T12:00:00Z") },
  ]);

  const [source] = await db
    .insert(entry)
    .values([
      // Inbox: 1 to triage (the deleted one and the processed one do not count).
      { workspaceId: ids.workspace, type: "note", title: "À trier", inboxStatus: "inbox" },
      { workspaceId: ids.workspace, type: "note", title: "Supprimée", inboxStatus: "inbox", deletedAt: at("2026-03-09T10:00:00Z") },
      { workspaceId: ids.workspace, type: "note", title: "Déjà triée", inboxStatus: "processed" },
      // Calls: only the one that is still to come today is listed.
      { workspaceId: ids.workspace, type: "call", title: "Appel mentor", inboxStatus: "processed", occurredAt: at("2026-03-10T13:00:00Z") },
      { workspaceId: ids.workspace, type: "call", title: "Appel passé", inboxStatus: "processed", occurredAt: at("2026-03-10T08:00:00Z") },
      { workspaceId: ids.workspace, type: "call", title: "Appel demain", inboxStatus: "processed", occurredAt: at("2026-03-11T13:00:00Z") },
    ])
    .returning({ id: entry.id });

  await db.insert(insight).values([
    { workspaceId: ids.workspace, sourceEntryId: source.id, type: "advice", content: "Relance tes acheteurs le dimanche soir", status: "accepted" },
    { workspaceId: ids.workspace, sourceEntryId: source.id, type: "lesson", content: "Proposée 1", status: "proposed" },
    { workspaceId: ids.workspace, sourceEntryId: source.id, type: "idea", content: "Proposée 2", status: "proposed" },
  ]);

  await db.insert(contact).values([
    { workspaceId: ids.workspace, name: "Léa", relationship: "mentor", nextInteractionAt: at("2026-03-10T15:00:00Z") },
    { workspaceId: ids.workspace, name: "Hugo", relationship: "client", nextInteractionAt: at("2026-03-12T15:00:00Z") },
  ]);
}

describe("brief du matin sur un vrai Postgres", () => {
  before(async () => {
    // Env must be set before the app modules are imported (they read it on first use).
    process.env.DATABASE_URL = testDatabaseUrl();
    process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
    process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
    delete process.env.ANTHROPIC_API_KEY; // rules only: no AI call in tests
    delete process.env.GOOGLE_CLIENT_ID;

    ({ db } = await import("@/server/db"));
    schema = await import("@/server/db/schema");
    ({ buildBrief, getBrief } = await import("@/server/ai/brief"));

    // Clean slate (cascades from user to workspace to everything else).
    await db.delete(schema.user);
    mock.timers.enable({ apis: ["Date"], now: NOW });
    await seed();
  });

  after(async () => {
    mock.timers.reset();
    await db.delete(schema.user);
    // Close the postgres.js pool so the test process can exit. `db` is a Proxy that
    // binds methods, so reach the real instance the app caches on globalThis.
    const real = (globalThis as { cockpitDb?: { $client: { end: () => Promise<void> } } }).cockpitDb;
    await real?.$client.end();
  });

  it("construit le brief sans erreur de requête (dates passées à postgres.js)", async () => {
    const { content, generatedBy, date } = await buildBrief(ids.workspace, { useAi: false });
    assert.equal(generatedBy, "rules");
    assert.equal(date, "2026-03-10");
    assert.ok(content.focus.length > 0);
  });

  it("compte les tâches en retard, du jour, terminées hier, l'inbox et les conseils proposés", async () => {
    const { content } = await buildBrief(ids.workspace, { useAi: false });
    assert.deepEqual(content.counts, { overdue: 1, today: 1, inbox: 1, proposed: 2, doneYesterday: 1 });
  });

  it("n'utilise jamais les données d'un autre espace", async () => {
    const { content } = await buildBrief(ids.otherWorkspace, { useAi: false });
    assert.deepEqual(content.counts, { overdue: 1, today: 0, inbox: 0, proposed: 0, doneYesterday: 1 });
    assert.equal(content.calls.length, 0);
    assert.equal(content.tip, null);
  });

  it("liste les appels restant aujourd'hui et les échanges prévus avec un contact", async () => {
    const { content } = await buildBrief(ids.workspace, { useAi: false });
    const titles = content.calls.map((call) => call.title);
    assert.ok(titles.includes("Appel mentor"));
    assert.ok(titles.includes("Échange prévu avec Léa"));
    assert.ok(!titles.includes("Appel passé"), "un appel déjà passé n'est plus à préparer");
    assert.ok(!titles.includes("Appel demain"));
    assert.ok(!titles.some((title) => title.includes("Hugo")), "un échange prévu un autre jour est exclu");
  });

  it("classe les priorités par urgence puis propose un conseil à appliquer", async () => {
    const { content } = await buildBrief(ids.workspace, { useAi: false });
    assert.deepEqual(
      content.priorities.map((priority) => priority.title),
      ["Pour aujourd'hui", "En retard"],
    );
    assert.equal(content.tip?.content, "Relance tes acheteurs le dimanche soir");
    assert.match(content.focus, /1 tâche en retard/);
  });

  it("enregistre le brief et le relit; le reconstruire met à jour la même ligne", async () => {
    await buildBrief(ids.workspace, { useAi: false });
    await buildBrief(ids.workspace, { useAi: false });
    const stored = await getBrief(ids.workspace, "2026-03-10");
    assert.ok(stored);
    assert.equal(stored.generatedBy, "rules");
    assert.equal(stored.content.counts.overdue, 1);
    const rows = await db.select().from(schema.dailyBrief);
    assert.equal(rows.filter((row) => row.workspaceId === ids.workspace && row.date === "2026-03-10").length, 1);
  });

  it("renvoie null quand il n'y a pas encore de brief ce jour-là", async () => {
    assert.equal(await getBrief(ids.workspace, "2026-03-09"), null);
  });
});
