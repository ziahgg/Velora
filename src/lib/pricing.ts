import type { PriceQuote } from '@/data/types';
import { addDays, isISODate, nightsBetween, type ISODate } from './dates';
import { assertCents, percentOf, type Cents } from './money';

/**
 * The one price calculation used by every screen, the demo backend and (in SQL)
 * the Supabase `create_booking` function. From the Figma price details:
 *
 *   room subtotal = nightly rate × nights × rooms
 *   taxes         = 10% of the room subtotal (hotel tax rate, rounded to the cent)
 *   fees          = resort fee per night × nights × rooms
 *   total         = subtotal + taxes + fees
 */
export function quoteStay(input: {
  nightlyRateCents: Cents;
  checkIn: ISODate;
  checkOut: ISODate;
  rooms: number;
  taxRateBps: number;
  resortFeePerNightCents: Cents;
}): PriceQuote {
  const { nightlyRateCents, checkIn, checkOut, rooms, taxRateBps, resortFeePerNightCents } = input;
  assertCents(nightlyRateCents);
  assertCents(resortFeePerNightCents);
  if (!Number.isInteger(rooms) || rooms < 1) throw new Error('At least one room is required');
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) throw new Error('Check-out must be after check-in');
  const subtotalCents = nightlyRateCents * nights * rooms;
  const taxCents = percentOf(subtotalCents, taxRateBps);
  const feesCents = resortFeePerNightCents * nights * rooms;
  return {
    nights,
    rooms,
    nightlyRateCents,
    subtotalCents,
    taxRateBps,
    taxCents,
    resortFeePerNightCents,
    feesCents,
    totalCents: subtotalCents + taxCents + feesCents,
  };
}

/** Last date free cancellation applies (null for non-refundable rates). */
export function freeCancelUntil(checkIn: ISODate, freeCancelDays: number | null): ISODate | null {
  if (freeCancelDays === null) return null;
  return addDays(checkIn, -freeCancelDays);
}

/** "10%" from basis points. */
export function formatRate(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

export const STAY_LIMITS = { maxNights: 30, maxAdults: 10, maxChildren: 6, maxRooms: 4, maxAdvanceDays: 365 } as const;

export interface StayInput {
  checkIn: ISODate;
  checkOut: ISODate;
  adults: number;
  children: number;
  rooms: number;
}

/** Validates dates and party size. Returns a human message, or null when valid. */
export function validateStay(stay: StayInput, today: ISODate): string | null {
  if (!isISODate(stay.checkIn) || !isISODate(stay.checkOut)) return 'Choose your check-in and check-out dates.';
  if (stay.checkIn < today) return 'Check-in can’t be in the past.';
  if (nightsBetween(today, stay.checkIn) > STAY_LIMITS.maxAdvanceDays) return 'Bookings open up to a year ahead.';
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  if (nights < 1) return 'Check-out must be after check-in.';
  if (nights > STAY_LIMITS.maxNights) return `Stays can be up to ${STAY_LIMITS.maxNights} nights.`;
  if (!Number.isInteger(stay.adults) || stay.adults < 1) return 'At least one adult is required.';
  if (stay.adults > STAY_LIMITS.maxAdults) return `Up to ${STAY_LIMITS.maxAdults} adults per booking.`;
  if (!Number.isInteger(stay.children) || stay.children < 0 || stay.children > STAY_LIMITS.maxChildren)
    return `Up to ${STAY_LIMITS.maxChildren} children per booking.`;
  if (!Number.isInteger(stay.rooms) || stay.rooms < 1 || stay.rooms > STAY_LIMITS.maxRooms)
    return `Choose between 1 and ${STAY_LIMITS.maxRooms} rooms.`;
  if (stay.rooms > stay.adults) return 'Each room needs at least one adult.';
  return null;
}

/** Whether a room type can host the party across the requested number of rooms. */
export function fitsParty(maxGuests: number, stay: Pick<StayInput, 'adults' | 'children' | 'rooms'>): boolean {
  return stay.adults + stay.children <= maxGuests * stay.rooms;
}
