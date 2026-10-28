import { NextResponse } from "next/server";
import { z } from "zod";
import { alreadyCaptured, captureEntry, ownerContext, safeEqual } from "@/server/inbound";

export const maxDuration = 60;

/**
 * Inbound email (Postmark inbound webhook format): forward anything to your
 * Cockpit address and it lands in the Inbox, attachments included. The webhook
 * URL carries INBOUND_EMAIL_SECRET, as ?token= or as the Basic auth password.
 */
const payload = z.object({
  MessageID: z.string().optional(),
  From: z.string().optional(),
  FromName: z.string().optional(),
  FromFull: z.object({ Email: z.string(), Name: z.string().optional() }).optional(),
  Subject: z.string().optional(),
  TextBody: z.string().optional(),
  HtmlBody: z.string().optional(),
  StrippedTextReply: z.string().optional(),
  Date: z.string().optional(),
  Attachments: z
    .array(z.object({ Name: z.string(), Content: z.string(), ContentType: z.string(), ContentLength: z.number().optional() }))
    .optional(),
});

function authorized(request: Request) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) return false;
  const token = new URL(request.url).searchParams.get("token");
  if (token && safeEqual(token, secret)) return true;
  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const password = Buffer.from(header.slice(6), "base64").toString().split(":").slice(1).join(":");
    return safeEqual(password, secret);
  }
  return false;
}

function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const parsed = payload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Format inattendu." }, { status: 400 });
  const mail = parsed.data;
  const me = await ownerContext();
  if (!me) return NextResponse.json({ error: "Cockpit n'est pas configuré." }, { status: 503 });

  if (mail.MessageID && (await alreadyCaptured(me.workspaceId, "emailMessageId", mail.MessageID))) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const fromEmail = mail.FromFull?.Email ?? mail.From?.match(/<([^>]+)>/)?.[1] ?? mail.From ?? null;
  const fromName = mail.FromFull?.Name || mail.FromName || fromEmail || "Email";
  const text = mail.TextBody?.trim() || (mail.HtmlBody ? htmlToText(mail.HtmlBody) : "");
  const files = (mail.Attachments ?? [])
    .filter((a) => (a.ContentLength ?? a.Content.length * 0.75) <= 25 * 1024 * 1024)
    .slice(0, 10)
    .map((a) => ({ name: a.Name, mimeType: a.ContentType, data: new Uint8Array(Buffer.from(a.Content, "base64")) }));

  const id = await captureEntry(me, {
    type: "message",
    title: mail.Subject?.trim() || `Email de ${fromName}`,
    body: `De : ${fromName}${fromEmail && fromEmail !== fromName ? ` <${fromEmail}>` : ""}\n\n${text}`,
    source: "email",
    occurredAt: mail.Date && !Number.isNaN(Date.parse(mail.Date)) ? new Date(mail.Date) : new Date(),
    meta: { channel: "email", emailMessageId: mail.MessageID, from: fromEmail },
    contactEmail: fromEmail,
    files,
  });
  return NextResponse.json({ ok: true, entryId: id });
}
