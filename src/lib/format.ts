import type { StayInput } from './pricing';
import { formatRange, nightsBetween, plural } from './dates';

/** "2 adults, 1 child" */
export function partyLabel(s: Pick<StayInput, 'adults' | 'children'>): string {
  return [plural(s.adults, 'adult'), s.children ? plural(s.children, 'child', 'children') : null].filter(Boolean).join(', ');
}

/** "3 guests" */
export function guestsLabel(s: Pick<StayInput, 'adults' | 'children'>): string {
  return plural(s.adults + s.children, 'guest');
}

/** "12 – 16 Nov · 2 adults, 1 child · 1 room" (Home search hero). */
export function staySummary(s: StayInput): string {
  return `${formatRange(s.checkIn, s.checkOut)} · ${partyLabel(s)}${s.rooms > 1 ? ` · ${s.rooms} rooms` : ''}`;
}

/** "12 – 16 Nov · 4 nights · 3 guests" (room selection bar). */
export function stayShort(s: StayInput): string {
  return `${formatRange(s.checkIn, s.checkOut)} · ${plural(nightsBetween(s.checkIn, s.checkOut), 'night')} · ${guestsLabel(s)}`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export function initials(fullName: string): string {
  const p = fullName.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || 'V';
}
