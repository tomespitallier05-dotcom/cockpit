// Date helpers that give the same answer on the server and in the browser, by
// always computing in the workspace timezone rather than the machine's.

export function dayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** "Aujourd'hui", "Hier", "Demain", or "lundi 26 octobre" (year added when not current). */
export function dayLabel(date: Date, timeZone: string, now = new Date()) {
  const key = dayKey(date, timeZone);
  if (key === dayKey(now, timeZone)) return "Aujourd'hui";
  if (key === dayKey(addDays(now, -1), timeZone)) return "Hier";
  if (key === dayKey(addDays(now, 1), timeZone)) return "Demain";
  const sameYear = key.slice(0, 4) === dayKey(now, timeZone).slice(0, 4);
  const label = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function timeLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Short due-date label for tasks: "Aujourd'hui", "Demain", "12 nov.". */
export function shortDayLabel(date: Date, timeZone: string, now = new Date()) {
  const label = dayLabel(date, timeZone, now);
  if (label === "Aujourd'hui" || label === "Hier" || label === "Demain") return label;
  return new Intl.DateTimeFormat("fr-FR", { timeZone, day: "numeric", month: "short" }).format(date);
}

/** Value for <input type="datetime-local"> in the browser's own timezone. */
export function toLocalInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Value for <input type="date"> in the browser's own timezone. */
export function toLocalDateValue(date: Date) {
  return toLocalInputValue(date).slice(0, 10);
}

/** End of the given local date (23:59) so "due today" stays due all day. */
export function endOfLocalDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 0, 0);
}

export function groupByDay<T>(items: T[], getDate: (item: T) => Date, timeZone: string) {
  const groups: { key: string; label: string; items: T[] }[] = [];
  const now = new Date();
  for (const item of items) {
    const date = getDate(item);
    const key = dayKey(date, timeZone);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(date, timeZone, now), items: [item] });
  }
  return groups;
}
