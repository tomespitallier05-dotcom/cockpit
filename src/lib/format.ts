// French formatting helpers. Times are shown in the workspace timezone so the
// server (UTC on Vercel) and the owner (Europe/Paris) agree.

export function hourIn(date: Date, timeZone: string) {
  return Number(
    new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hourCycle: "h23", timeZone }).format(date),
  );
}

export function greetingFor(date: Date, timeZone: string) {
  const hour = hourIn(date, timeZone);
  if (hour < 5) return "Bonne nuit";
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatLongDate(date: Date, timeZone: string) {
  return capitalize(
    new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone }).format(date),
  );
}

export function formatShortDate(date: Date, timeZone = "Europe/Paris") {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone }).format(date);
}

const relative = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function formatRelative(date: Date, now: Date) {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.round(seconds / size), unit);
    }
  }
  return "à l'instant";
}
