import "server-only";
import { and, eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { account } from "./db/schema";

/**
 * Google Calendar and Drive, through the Google account linked in Settings.
 * Better Auth stores the tokens encrypted and refreshes them on demand.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function googleAccount(userId: string) {
  const [row] = await db
    .select({ id: account.id, scope: account.scope, createdAt: account.createdAt })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "google")));
  if (!row) return null;
  const scopes = (row.scope ?? "").split(/[\s,]+/);
  return {
    id: row.id,
    calendar: scopes.includes(GOOGLE_SCOPES[0]),
    drive: scopes.includes(GOOGLE_SCOPES[1]),
    connectedAt: row.createdAt,
  };
}

async function accessToken(userId: string) {
  const linked = await googleAccount(userId);
  if (!linked) throw new Error("Google n'est pas connecté.");
  const tokens = await auth.api.getAccessToken({ body: { accountId: linked.id, userId } });
  if (!tokens?.accessToken) throw new Error("Jeton Google indisponible : reconnecte Google dans les réglages.");
  return tokens.accessToken;
}

async function googleFetch(userId: string, url: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken(userId)}` }, cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google a répondu ${response.status}${detail ? ` : ${detail.slice(0, 160)}` : ""}`);
  }
  return response;
}

export type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date | null;
  meetLink: string | null;
  attendees: { email: string; name: string | null }[];
  htmlLink: string | null;
};

export async function upcomingEvents(userId: string, days = 7): Promise<CalendarEvent[]> {
  const now = new Date();
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + days * 86400000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "30",
  });
  const response = await googleFetch(userId, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`);
  const body = (await response.json()) as {
    items?: {
      id: string;
      summary?: string;
      status?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      hangoutLink?: string;
      htmlLink?: string;
      attendees?: { email?: string; displayName?: string; self?: boolean; resource?: boolean }[];
    }[];
  };
  return (body.items ?? [])
    .filter((item) => item.status !== "cancelled" && item.start?.dateTime)
    .map((item) => ({
      id: item.id,
      title: item.summary || "Sans titre",
      start: new Date(item.start!.dateTime!),
      end: item.end?.dateTime ? new Date(item.end.dateTime) : null,
      meetLink: item.hangoutLink ?? null,
      htmlLink: item.htmlLink ?? null,
      attendees: (item.attendees ?? [])
        .filter((a) => a.email && !a.self && !a.resource)
        .map((a) => ({ email: a.email!.toLowerCase(), name: a.displayName ?? null })),
    }));
}

export type DriveFile = { id: string; name: string; mimeType: string; size: number | null; modifiedTime: string };

const IMPORTABLE = [
  "mimeType contains 'audio/'",
  "mimeType contains 'video/'",
  "mimeType = 'application/pdf'",
  "mimeType = 'application/vnd.google-apps.document'",
  "mimeType contains 'image/'",
  "mimeType = 'text/plain'",
];

/** Recent importable files: Meet recordings and transcripts, audio notes, PDFs, Docs. */
export async function recentDriveFiles(userId: string, search?: string): Promise<DriveFile[]> {
  const filters = [`(${IMPORTABLE.join(" or ")})`, "trashed = false"];
  if (search?.trim()) filters.push(`name contains '${search.trim().replace(/['\\]/g, " ")}'`);
  const params = new URLSearchParams({
    q: filters.join(" and "),
    orderBy: "modifiedTime desc",
    pageSize: "30",
    fields: "files(id,name,mimeType,size,modifiedTime)",
  });
  const response = await googleFetch(userId, `https://www.googleapis.com/drive/v3/files?${params}`);
  const body = (await response.json()) as { files?: (Omit<DriveFile, "size"> & { size?: string })[] };
  return (body.files ?? []).map((file) => ({ ...file, size: file.size ? Number(file.size) : null }));
}

/** Downloads a Drive file; Google Docs are exported as plain text. */
export async function downloadDriveFile(userId: string, fileId: string) {
  const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
  const metaResponse = await googleFetch(userId, `${base}?fields=id,name,mimeType,size,createdTime`);
  const meta = (await metaResponse.json()) as { id: string; name: string; mimeType: string; size?: string; createdTime?: string };
  const isDoc = meta.mimeType === "application/vnd.google-apps.document";
  const response = await googleFetch(userId, isDoc ? `${base}/export?mimeType=text/plain` : `${base}?alt=media`);
  const data = new Uint8Array(await response.arrayBuffer());
  return {
    name: isDoc ? `${meta.name}.txt` : meta.name,
    mimeType: isDoc ? "text/plain" : meta.mimeType,
    data,
    createdTime: meta.createdTime ? new Date(meta.createdTime) : new Date(),
  };
}
