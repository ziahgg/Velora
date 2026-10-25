import type { Booking, BookingStatus, PaymentStatus } from '@/data/types';
import { nightsBetween, type ISODate } from './dates';

/** How long an unpaid booking holds the room ("We’re holding your villa for 15:00 more minutes"). */
export const HOLD_MINUTES = 15;

/**
 * Allowed booking status transitions. The database enforces the same table
 * in `bookings_status_guard`.
 */
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending_payment: ['confirmed', 'expired', 'cancelled'],
  confirmed: ['cancelled'],
  cancelled: [],
  expired: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  unpaid: ['paid', 'failed'],
  failed: ['paid', 'failed'],
  paid: ['voided'],
  voided: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/** A pending booking whose hold has run out is treated as expired everywhere. */
export function effectiveStatus(b: Pick<Booking, 'status' | 'holdExpiresAt'>, now = new Date()): BookingStatus {
  if (b.status === 'pending_payment' && b.holdExpiresAt && new Date(b.holdExpiresAt).getTime() <= now.getTime()) return 'expired';
  return b.status;
}

/** Bookings that still occupy inventory: confirmed, or pending with a live hold. */
export function holdsInventory(b: Pick<Booking, 'status' | 'holdExpiresAt'>, now = new Date()): boolean {
  const s = effectiveStatus(b, now);
  return s === 'confirmed' || s === 'pending_payment';
}

export type TripTab = 'upcoming' | 'completed' | 'cancelled';

/** Which My Trips tab a booking belongs on. Pending (unpaid) bookings show as upcoming with an action. */
export function tripTab(b: Booking, today: ISODate, now = new Date()): TripTab | null {
  const s = effectiveStatus(b, now);
  if (s === 'cancelled' || s === 'expired') return s === 'cancelled' ? 'cancelled' : null;
  return b.checkOut <= today ? 'completed' : 'upcoming';
}

/** Cancellation is allowed for confirmed, not-yet-started stays, and pending holds. */
export function cancellationAllowed(b: Booking, today: ISODate, now = new Date()): { allowed: boolean; refundable: boolean; reason?: string } {
  const s = effectiveStatus(b, now);
  if (s === 'pending_payment') return { allowed: true, refundable: true };
  if (s !== 'confirmed') return { allowed: false, refundable: false, reason: 'This booking can no longer be changed.' };
  if (b.checkIn <= today) return { allowed: false, refundable: false, reason: 'Stays that have started can’t be cancelled in the app.' };
  const refundable = b.freeCancelUntil !== null && today <= b.freeCancelUntil;
  return { allowed: true, refundable };
}

export function daysUntil(date: ISODate, today: ISODate): number {
  return nightsBetween(today, date);
}

/** "VLR-48217" style reference from a numeric sequence. */
export function bookingReference(seq: number): string {
  return `VLR-${String(seq).padStart(5, '0')}`;
}

export function holdSecondsLeft(holdExpiresAt: string | null, now = new Date()): number {
  if (!holdExpiresAt) return 0;
  return Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - now.getTime()) / 1000));
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
