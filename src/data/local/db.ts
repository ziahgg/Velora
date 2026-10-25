import { addDays, todayISO } from '@/lib/dates';
import { bookingReference } from '@/lib/booking';
import { freeCancelUntil, quoteStay } from '@/lib/pricing';
import { seedCatalog } from '../seed';
import type { Booking, Profile } from '../types';

/**
 * Shape of the on-device demo database (AsyncStorage). Development only — the
 * Supabase schema in supabase/migrations is the production source of truth.
 */
export interface LocalUser {
  id: string;
  email: string;
  passwordHash: string;
}

export interface LocalPayment {
  id: string;
  bookingId: string;
  userId: string;
  provider: 'sandbox';
  providerReference: string;
  status: 'succeeded' | 'declined';
  methodLabel: string;
  amountCents: number;
  idempotencyKey: string;
  createdAt: string;
}

export interface LocalDB {
  version: 1;
  users: LocalUser[];
  profiles: Profile[];
  sessionUserId: string | null;
  favorites: { userId: string; hotelId: string; createdAt: string }[];
  bookings: (Booking & { idempotencyKey: string })[];
  payments: LocalPayment[];
  nextReference: number;
}

export const DEMO_EMAIL = 'ziah@velora.travel';
export const DEMO_PASSWORD = 'velora2026';
const DEMO_USER_ID = 'user-demo-ziah';

/** A confirmed sample booking for the demo account, priced with the shared quote function. */
function sampleBooking(seq: number, hotelId: string, roomId: string, checkIn: string, nights: number, createdDaysAgo: number, now: Date): LocalDB['bookings'][number] {
  const hotel = seedCatalog.hotels.find((h) => h.id === hotelId)!;
  const room = hotel.rooms.find((r) => r.id === roomId)!;
  const checkOut = addDays(checkIn, nights);
  const created = new Date(now.getTime() - createdDaysAgo * 86_400_000).toISOString();
  return {
    id: `bkg-sample-${seq}`,
    reference: bookingReference(seq),
    userId: DEMO_USER_ID,
    hotelId,
    roomTypeId: roomId,
    checkIn,
    checkOut,
    adults: 2,
    children: 0,
    rooms: 1,
    guestName: 'Ziah Makmur',
    guestPhone: '+62 852 3239 6140',
    guestEmail: DEMO_EMAIL,
    specialRequests: '',
    status: 'confirmed',
    paymentStatus: 'paid',
    quote: quoteStay({ nightlyRateCents: room.pricePerNightCents, checkIn, checkOut, rooms: 1, taxRateBps: hotel.taxRateBps, resortFeePerNightCents: hotel.resortFeePerNightCents }),
    freeCancelUntil: freeCancelUntil(checkIn, room.freeCancelDays),
    holdExpiresAt: null,
    paidWith: 'Mastercard ·· 4444 (sandbox)',
    createdAt: created,
    confirmedAt: created,
    cancelledAt: null,
    idempotencyKey: `seed-${seq}`,
  };
}

/** Fresh demo database: one demo account with saved stays, an upcoming and a past trip. */
export function buildLocalDB(demoPasswordHash: string, now = new Date()): LocalDB {
  const today = todayISO(now);
  const iso = now.toISOString();
  return {
    version: 1,
    users: [{ id: DEMO_USER_ID, email: DEMO_EMAIL, passwordHash: demoPasswordHash }],
    profiles: [{ id: DEMO_USER_ID, email: DEMO_EMAIL, fullName: 'Ziah Makmur', phone: '+62 852 3239 6140', notificationsEnabled: true, currency: 'USD' }],
    sessionUserId: null,
    favorites: ['azure-lagoon', 'caldera-cliff', 'grand-horizon', 'palm-courtyard', 'jungle-mist', 'lagoon-bay'].map((hotelId) => ({ userId: DEMO_USER_ID, hotelId, createdAt: iso })),
    bookings: [
      sampleBooking(49102, 'caldera-cliff', 'cc-cave-suite', addDays(today, 40), 5, 6, now),
      sampleBooking(47311, 'palm-courtyard', 'pc-garden', addDays(today, -62), 3, 90, now),
    ],
    payments: [],
    nextReference: 48217,
  };
}
