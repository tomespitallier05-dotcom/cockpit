/**
 * Parser for WhatsApp's "Export chat" text file, iOS and Android formats, in
 * French (DD/MM) date order:
 *   [12/03/2024, 14:23:45] Karim : Salut
 *   12/03/2024 14:23 - Karim: Salut
 * Lines without a header continue the previous message. System lines
 * (encryption notice, "X a créé le groupe"…) have no author and are skipped.
 */
export type WhatsAppMessage = { date: string; time: string; author: string; text: string };
export type WhatsAppDay = { date: string; messages: WhatsAppMessage[] };

const HEADER =
  /^[‎‏]?\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2})[:h](\d{2})(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?\]?\s*(?:[-–]\s*)?(.*)$/;

export function parseWhatsApp(raw: string) {
  const messages: WhatsAppMessage[] = [];
  for (const line of raw.replace(/\r/g, "").split("\n")) {
    const match = HEADER.exec(line);
    if (match) {
      const [, d, m, y, hh, mm, rest] = match;
      const year = y.length === 2 ? `20${y}` : y;
      const date = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      const separator = rest.indexOf(": ");
      if (separator <= 0) continue; // system line
      const author = rest.slice(0, separator).replace(/[‎‏]/g, "").trim();
      const text = rest.slice(separator + 2).replace(/[‎‏]/g, "").trim();
      if (!author || author.length > 60) continue;
      messages.push({ date, time: `${hh.padStart(2, "0")}:${mm}`, author, text });
    } else if (messages.length && line.trim()) {
      messages[messages.length - 1].text += `\n${line.trim()}`;
    }
  }

  const days = new Map<string, WhatsAppMessage[]>();
  for (const message of messages) {
    const list = days.get(message.date) ?? [];
    list.push(message);
    days.set(message.date, list);
  }
  const participants = [...new Set(messages.map((m) => m.author))];
  return {
    days: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({ date, messages: list })),
    participants,
    count: messages.length,
  };
}
