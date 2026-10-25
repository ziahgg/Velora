/**
 * Stay dates are calendar days ("2026-11-12"), not instants. They are kept as
 * ISO date strings and compared as UTC midnights, so time zones and DST never
 * change the night count.
 */
export type ISODate = string;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: string): value is ISODate {
  if (!ISO.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toUTC(date: ISODate): number {
  if (!isISODate(date)) throw new Error(`Invalid date: ${date}`);
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: ISODate, days: number): ISODate {
  return new Date(toUTC(date) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Number of nights between check-in and check-out (check-out day is not a night). */
export function nightsBetween(checkIn: ISODate, checkOut: ISODate): number {
  return Math.round((toUTC(checkOut) - toUTC(checkIn)) / 86_400_000);
}

/** Today's calendar date on this device. */
export function todayISO(now = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Stays overlap when one starts before the other ends (check-out days don't clash). */
export function rangesOverlap(aIn: ISODate, aOut: ISODate, bIn: ISODate, bOut: ISODate): boolean {
  return aIn < bOut && bIn < aOut;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parts(date: ISODate) {
  const d = new Date(toUTC(date));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay() };
}

/** "Thu, 12 Nov" */
export function formatDay(date: ISODate): string {
  const p = parts(date);
  return `${DAYS[p.weekday]}, ${p.day} ${MONTHS[p.month]}`;
}

/** "Thu 12 Nov" */
export function formatDayNoComma(date: ISODate): string {
  const p = parts(date);
  return `${DAYS[p.weekday]} ${p.day} ${MONTHS[p.month]}`;
}

/** "12 – 16 Nov", or "28 Nov – 2 Dec" across months. */
export function formatRange(checkIn: ISODate, checkOut: ISODate): string {
  const a = parts(checkIn);
  const b = parts(checkOut);
  if (a.year === b.year && a.month === b.month) return `${a.day} – ${b.day} ${MONTHS[b.month]}`;
  return `${a.day} ${MONTHS[a.month]} – ${b.day} ${MONTHS[b.month]}`;
}

/** "10 Nov" */
export function formatShort(date: ISODate): string {
  const p = parts(date);
  return `${p.day} ${MONTHS[p.month]}`;
}

/** "November 2026" */
export function formatMonth(year: number, month: number): string {
  return `${MONTHS_LONG[month]} ${year}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
