import { createPublicKey, verify } from "node:crypto";
import { after, NextResponse } from "next/server";
import { recordAttachment } from "@/server/attachments";
import { alreadyCaptured, captureEntry, ownerContext } from "@/server/inbound";
import { newStorageKey, storeFile } from "@/server/storage";

/**
 * Discord bot over HTTP interactions (no gateway process to host):
 *   /save texte:…                      → a note in the Inbox
 *   message menu "Enregistrer dans Cockpit" → that message (and its files)
 * Installed as a user app it also works in DMs. Only DISCORD_OWNER_ID may use it,
 * and every request must carry Discord's Ed25519 signature.
 */
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function signatureValid(body: string, signature: string | null, timestamp: string | null) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey || !signature || !timestamp) return false;
  try {
    const key = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKey, "hex")]), format: "der", type: "spki" });
    return verify(null, Buffer.from(timestamp + body), key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

const reply = (content: string) => NextResponse.json({ type: 4, data: { content, flags: 64 } });

type Attachment = { url: string; filename: string; content_type?: string; size: number };
type Interaction = {
  type: number;
  guild_id?: string;
  channel_id?: string;
  member?: { user: { id: string } };
  user?: { id: string };
  data?: {
    name: string;
    type: number;
    target_id?: string;
    options?: { name: string; value: string }[];
    resolved?: {
      messages?: Record<string, { id: string; content: string; timestamp: string; author: { username: string; global_name?: string | null }; attachments: Attachment[] }>;
    };
  };
};

export async function POST(request: Request) {
  const body = await request.text();
  if (!signatureValid(body, request.headers.get("x-signature-ed25519"), request.headers.get("x-signature-timestamp"))) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }
  const interaction = JSON.parse(body) as Interaction;
  if (interaction.type === 1) return NextResponse.json({ type: 1 });

  const userId = interaction.member?.user.id ?? interaction.user?.id;
  if (!process.env.DISCORD_OWNER_ID || userId !== process.env.DISCORD_OWNER_ID) return reply("Ce bot est privé.");
  const me = await ownerContext();
  if (!me) return reply("Cockpit n'est pas encore configuré.");
  const base = process.env.BETTER_AUTH_URL ?? "";

  if (interaction.type === 2 && interaction.data?.name === "save") {
    const text = interaction.data.options?.find((o) => o.name === "texte")?.value?.trim() ?? "";
    if (!text) return reply("Rien à enregistrer.");
    const id = await captureEntry(me, {
      type: "note",
      title: null,
      body: text,
      source: "discord",
      meta: { channel: "discord" },
    });
    return reply(`Enregistré dans ton Inbox ✓ ${base}/entrees/${id}`);
  }

  if (interaction.type === 2 && interaction.data?.type === 3 && interaction.data.target_id) {
    const message = interaction.data.resolved?.messages?.[interaction.data.target_id];
    if (!message) return reply("Message introuvable.");
    const existing = await alreadyCaptured(me.workspaceId, "discordMessageId", message.id);
    if (existing) return reply(`Déjà dans Cockpit : ${base}/entrees/${existing}`);
    const author = message.author.global_name || message.author.username;
    const link = `https://discord.com/channels/${interaction.guild_id ?? "@me"}/${interaction.channel_id}/${message.id}`;
    const attachments = message.attachments.filter((a) => a.size <= 25 * 1024 * 1024).slice(0, 5);
    const id = await captureEntry(me, {
      type: "message",
      title: `Discord · ${author}`,
      body: `${author} : ${message.content}`.trim(),
      source: "discord",
      occurredAt: new Date(message.timestamp),
      meta: { channel: "discord", url: link, discordMessageId: message.id, author },
    });
    if (attachments.length) {
      // Discord wants an answer within 3 seconds: files are copied afterwards.
      after(async () => {
        const files = [];
        for (const a of attachments) {
          const response = await fetch(a.url).catch(() => null);
          if (response?.ok) files.push({ name: a.filename, mimeType: a.content_type ?? "application/octet-stream", data: new Uint8Array(await response.arrayBuffer()) });
        }
        if (files.length) {
          for (const file of files) {
            const key = newStorageKey(me.workspaceId, file.name);
            await storeFile(key, file.data, file.mimeType);
            await recordAttachment(me, { storageKey: key, fileName: file.name, mimeType: file.mimeType, sizeBytes: file.data.byteLength }, id);
          }
        }
      });
    }
    return reply(`Message de ${author} enregistré ✓ ${base}/entrees/${id}`);
  }

  return reply("Commande inconnue.");
}
