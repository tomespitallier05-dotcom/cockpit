// Review periods as calendar dates ("YYYY-MM-DD") in the owner's timezone.
// Weeks start on Monday.

export type Period = "day" | "week" | "month" | "quarter" | "year";

export const PERIOD_LABELS: Record<Period, string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
  quarter: "Trimestre",
  year: "Année",
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (date: string) => new Date(`${date}T00:00:00Z`);

export function addDaysTo(date: string, days: number) {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

/** The period containing `date`, shifted by `offset` periods (-1 = the previous one). */
export function periodRange(period: Period, date: string, offset = 0): { start: string; end: string } {
  const d = parse(date);
  if (period === "day") {
    const day = addDaysTo(date, offset);
    return { start: day, end: day };
  }
  if (period === "week") {
    const weekday = (d.getUTCDay() + 6) % 7;
    const start = addDaysTo(date, -weekday + offset * 7);
    return { start, end: addDaysTo(start, 6) };
  }
  const months = period === "month" ? 1 : period === "quarter" ? 3 : 12;
  const firstMonth = period === "year" ? 0 : Math.floor(d.getUTCMonth() / months) * months;
  const start = new Date(Date.UTC(d.getUTCFullYear(), firstMonth + offset * months, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 0));
  return { start: iso(start), end: iso(end) };
}

export function periodTitle(period: Period, start: string) {
  const d = parse(start);
  if (period === "day") return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  if (period === "week") {
    const end = parse(addDaysTo(start, 6));
    return `Semaine du ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })} au ${end.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })}`;
  }
  if (period === "month") return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  if (period === "quarter") return `T${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
  return `Année ${d.getUTCFullYear()}`;
}
