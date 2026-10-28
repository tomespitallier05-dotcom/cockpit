"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { zonedInstant } from "@/lib/dates";
import { textToDoc } from "@/lib/entry-catalog";
import { indexEntry } from "../ai/semantic";
import { assertOwnContacts, fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { entry, entryContact } from "../db/schema";
import { getActionUser } from "../session";

const message = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  author: z.string().max(80),
  text: z.string().max(20_000),
});

const whatsappInput = z.object({
  chatName: z.string().trim().min(1).max(120),
  ownerName: z.string().max(80).nullable(),
  contactId: z.uuid().nullable(),
  days: z
    .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), messages: z.array(message).max(2000) }))
    .max(90),
});

/**
 * Imports one chunk (≤ 90 days) of a WhatsApp export: one message entry per day,
 * linked to the contact, skipped when that day was already imported. History is
 * indexed for search right away; the daily job analyses it gradually.
 */
export async function importWhatsAppDays(input: z.input<typeof whatsappInput>): Promise<ActionResult<{ created: number; skipped: number }>> {
  try {
    const me = await getActionUser();
    const data = whatsappInput.parse(input);
    const [contactId] = data.contactId ? await assertOwnContacts(me, [data.contactId]) : [null];
    const keys = data.days.map((day) => `whatsapp:${data.chatName}:${day.date}`);
    const existing = keys.length
      ? await db
          .select({ key: sql<string>`${entry.meta}->>'importKey'` })
          .from(entry)
          .where(and(eq(entry.workspaceId, me.workspaceId), inArray(sql`${entry.meta}->>'importKey'`, keys)))
      : [];
    const done = new Set(existing.map((row) => row.key));

    const created: { id: string; text: string; heading: string }[] = [];
    for (const day of data.days) {
      const importKey = `whatsapp:${data.chatName}:${day.date}`;
      if (done.has(importKey) || day.messages.length === 0) continue;
      const body = day.messages
        .map((m) => `${m.time} ${m.author === data.ownerName ? "Moi" : m.author} : ${m.text}`)
        .join("\n");
      const label = new Date(`${day.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      const title = `WhatsApp · ${data.chatName} · ${label}`;
      const [row] = await db
        .insert(entry)
        .values({
          workspaceId: me.workspaceId,
          type: "message",
          title,
          content: textToDoc(body),
          plainText: body,
          occurredAt: zonedInstant(day.date, day.messages[0].time, me.timezone),
          source: "whatsapp",
          meta: { channel: "whatsapp", importKey, ai: { status: "pending" } },
          inboxStatus: "inbox",
        })
        .returning({ id: entry.id });
      if (contactId) await db.insert(entryContact).values({ entryId: row.id, contactId, role: "participant" });
      created.push({ id: row.id, text: body, heading: `${title} — ${day.date}` });
    }

    after(async () => {
      for (const item of created) {
        await indexEntry(me.workspaceId, item.id, item.text, item.heading).catch((error) => console.error("index whatsapp", error));
      }
    });
    refresh();
    return ok({ created: created.length, skipped: data.days.length - created.length });
  } catch (error) {
    return fail(error);
  }
}
