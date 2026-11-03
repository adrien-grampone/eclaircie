import type { IsoDate } from "./types.ts";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return toIsoDate(date) === value;
}

/** Millisecondes UTC à minuit pour une date calendaire. Lance si la date est invalide. */
export function toUtcMs(date: IsoDate): number {
  if (!isIsoDate(date)) {
    throw new Error(`Date invalide, attendu YYYY-MM-DD : "${date}"`);
  }
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Formate une Date en 'YYYY-MM-DD' à partir de ses composantes UTC. */
export function toIsoDate(date: Date): IsoDate {
  const y = date.getUTCFullYear().toString().padStart(4, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIsoDate(new Date(toUtcMs(date) + days * MS_PER_DAY));
}

/** Nombre de jours entiers de `from` à `to` (négatif si `to` précède `from`). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/** Date calendaire (UTC) d'un timestamp ISO, ex. '2026-10-01T23:30:00+02:00' → '2026-10-01'. */
export function dateOfTimestamp(timestamp: string): IsoDate {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Timestamp invalide : "${timestamp}"`);
  }
  return toIsoDate(parsed);
}
