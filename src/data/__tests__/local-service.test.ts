/* eslint-disable @typescript-eslint/no-require-imports, import/first -- jest.mock factories must be hoisted above imports */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-crypto', () => {
  const { createHash, randomUUID } = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_alg: string, value: string) => createHash('sha256').update(value).digest('hex'),
    randomUUID: () => randomUUID(),
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';

import { addDays, todayISO } from '@/lib/dates';
import { quoteStay } from '@/lib/pricing';
import { createSandboxAdapter } from '@/payments/adapter';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../local/db';
import { createLocalService } from '../local/service';
import { AppError, type CreateBookingInput, type PaymentResult } from '../service';

let clock = new Date('2026-10-25T10:00:00Z');
const now = () => clock;
const today = () => todayISO(clock);

beforeEach(async () => {
  await AsyncStorage.clear();
  clock = new Date('2026-10-25T10:00:00Z');
});

async function signedIn() {
  const api = createLocalService({ now });
  await api.signIn(DEMO_EMAIL, DEMO_PASSWORD);
  return api;
}

function input(over: Partial<CreateBookingInput> = {}): CreateBookingInput {
  const checkIn = addDays(today(), 18);
  const checkOut = addDays(checkIn, 4);
  return {
    hotelId: 'grand-horizon',
    roomTypeId: 'gh-ocean-villa',
    checkIn,
    checkOut,
    adults: 2,
    children: 1,
    rooms: 1,
    guestName: 'Ziah Makmur',
    guestPhone: '+62 852 3239 6140',
    specialRequests: '',
    expectedTotalCents: quoteStay({ nightlyRateCents: 57900, checkIn, checkOut, rooms: 1, taxRateBps: 1000, resortFeePerNightCents: 2500 }).totalCents,
    idempotencyKey: 'review-visit-1',
    ...over,
  };
}

const paid: PaymentResult = { status: 'succeeded', provider: 'sandbox', providerReference: 'sbx_1', methodLabel: 'Mastercard ·· 4444 (sandbox)' };
const declined: PaymentResult = { status: 'declined', provider: 'sandbox', providerReference: 'sbx_2', methodLabel: 'Test card ·· 0002 (sandbox)' };

describe('demo backend — auth', () => {
  it('rejects a wrong password and unknown users', async () => {
    const api = createLocalService({ now });
    await expect(api.signIn(DEMO_EMAIL, 'nope')).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(api.signIn('who@velora.travel', DEMO_PASSWORD)).rejects.toBeInstanceOf(AppError);
  });

  it('signs up a new user with an empty account, and refuses duplicates', async () => {
    const api = createLocalService({ now });
    await api.signUp({ fullName: 'Ana Lima', email: 'ana@example.com', password: 'travel123' });
    expect((await api.getProfile()).fullName).toBe('Ana Lima');
    expect(await api.listBookings()).toEqual([]);
    expect(await api.listFavorites()).toEqual([]);
    await api.signOut();
    await expect(api.signUp({ fullName: 'Ana', email: 'ANA@example.com', password: 'travel123' })).rejects.toMatchObject({ code: 'email_taken' });
  });

  it('requires a session for private data', async () => {
    const api = createLocalService({ now });
    await expect(api.listBookings()).rejects.toMatchObject({ code: 'auth' });
  });
});

describe('demo backend — booking', () => {
  it('prices on the trusted side and holds the room', async () => {
    const api = await signedIn();
    const b = await api.createBooking(input());
    expect(b.status).toBe('pending_payment');
    expect(b.quote.totalCents).toBe(264760);
    expect(b.reference).toBe('VLR-48217');
    expect(new Date(b.holdExpiresAt!).getTime() - clock.getTime()).toBe(15 * 60_000);
    expect(b.freeCancelUntil).toBe(addDays(b.checkIn, -2));
  });

  it('rejects a client total that differs from the server price', async () => {
    const api = await signedIn();
    await expect(api.createBooking(input({ expectedTotalCents: 100 }))).rejects.toMatchObject({ code: 'price_changed' });
  });

  it('returns the same booking for a repeated request (double tap)', async () => {
    const api = await signedIn();
    const [a, b] = await Promise.all([api.createBooking(input()), api.createBooking(input())]);
    expect(a.id).toBe(b.id);
    expect((await api.listBookings()).filter((x) => x.status === 'pending_payment')).toHaveLength(1);
  });

  it('checks capacity, dates and guest details', async () => {
    const api = await signedIn();
    await expect(api.createBooking(input({ roomTypeId: 'gh-cliff-suite', idempotencyKey: 'k2' }))).rejects.toMatchObject({ code: 'capacity' });
    await expect(api.createBooking(input({ checkOut: input().checkIn, idempotencyKey: 'k3' }))).rejects.toMatchObject({ code: 'validation' });
    await expect(api.createBooking(input({ guestPhone: 'abc', idempotencyKey: 'k4' }))).rejects.toMatchObject({ code: 'validation' });
    await expect(api.createBooking(input({ roomTypeId: 'nope', idempotencyKey: 'k5' }))).rejects.toMatchObject({ code: 'not_found' });
  });

  it('enforces inventory across overlapping nights, and frees it when a hold expires', async () => {
    const api = await signedIn();
    const family = (key: string, rooms: number, offset = 0) => {
      const checkIn = addDays(today(), 30 + offset);
      const checkOut = addDays(checkIn, 2);
      return input({ roomTypeId: 'gh-family-villa', checkIn, checkOut, adults: 2, children: 0, rooms, idempotencyKey: key, expectedTotalCents: quoteStay({ nightlyRateCents: 89000, checkIn, checkOut, rooms, taxRateBps: 1000, resortFeePerNightCents: 2500 }).totalCents });
    };
    await api.createBooking(family('f1', 2));
    await expect(api.createBooking(family('f2', 1, 1))).rejects.toMatchObject({ code: 'unavailable' });
    expect((await api.getAvailability(['gh-family-villa'], addDays(today(), 30), addDays(today(), 32)))['gh-family-villa']).toBe(0);
    clock = new Date(clock.getTime() + 16 * 60_000);
    expect((await api.getAvailability(['gh-family-villa'], addDays(today(), 30), addDays(today(), 32)))['gh-family-villa']).toBe(2);
    await expect(api.createBooking(family('f3', 1, 1))).resolves.toMatchObject({ status: 'pending_payment' });
  });
});

describe('demo backend — payment', () => {
  it('keeps the booking pending after a decline, then confirms on success', async () => {
    const api = await signedIn();
    const b = await api.createBooking(input());
    const afterDecline = await api.recordPayment(b.id, declined, 'p1');
    expect(afterDecline).toMatchObject({ status: 'pending_payment', paymentStatus: 'failed' });
    const afterPay = await api.recordPayment(b.id, paid, 'p2');
    expect(afterPay).toMatchObject({ status: 'confirmed', paymentStatus: 'paid', holdExpiresAt: null, paidWith: paid.methodLabel });
  });

  it('ignores duplicate payment submissions', async () => {
    const api = await signedIn();
    const b = await api.createBooking(input());
    const [x, y] = await Promise.all([api.recordPayment(b.id, paid, 'p1'), api.recordPayment(b.id, paid, 'p1')]);
    expect(x.status).toBe('confirmed');
    expect(y.status).toBe('confirmed');
    const again = await api.recordPayment(b.id, { ...paid, providerReference: 'sbx_9' }, 'p9');
    expect(again.confirmedAt).toBe(x.confirmedAt);
  });

  it('refuses payment once the hold has ended', async () => {
    const api = await signedIn();
    const b = await api.createBooking(input());
    clock = new Date(clock.getTime() + 15 * 60_000 + 1000);
    await expect(api.recordPayment(b.id, paid, 'late')).rejects.toMatchObject({ code: 'hold_expired' });
  });

  it('the sandbox adapter succeeds or declines per test method', async () => {
    const adapter = createSandboxAdapter(0);
    const [apple, , , decliner] = adapter.listMethods();
    await expect(adapter.charge({ bookingId: 'b', amountCents: 100, method: apple })).resolves.toMatchObject({ status: 'succeeded', provider: 'sandbox' });
    await expect(adapter.charge({ bookingId: 'b', amountCents: 100, method: decliner })).resolves.toMatchObject({ status: 'declined' });
  });
});

describe('demo backend — cancellation, favorites, isolation', () => {
  it('cancels a refundable paid booking and voids the sandbox payment', async () => {
    const api = await signedIn();
    const b = await api.createBooking(input());
    await api.recordPayment(b.id, paid, 'p1');
    const c = await api.cancelBooking(b.id);
    expect(c).toMatchObject({ status: 'cancelled', paymentStatus: 'voided' });
    await expect(api.cancelBooking(b.id)).rejects.toMatchObject({ code: 'validation' });
  });

  it('does not duplicate favorites', async () => {
    const api = await signedIn();
    const before = (await api.listFavorites()).length;
    await api.setFavorite('kata-palm', true);
    await api.setFavorite('kata-palm', true);
    expect((await api.listFavorites()).length).toBe(before + 1);
    await api.setFavorite('kata-palm', false);
    expect((await api.listFavorites()).length).toBe(before);
  });

  it('keeps one user’s bookings private from another', async () => {
    const api = await signedIn();
    const b = await api.createBooking(input());
    await api.signOut();
    await api.signUp({ fullName: 'Other Guest', email: 'other@example.com', password: 'travel123' });
    expect(await api.listBookings()).toEqual([]);
    await expect(api.getBooking(b.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(api.cancelBooking(b.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(api.recordPayment(b.id, paid, 'x')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('persists bookings across app restarts', async () => {
    const api = await signedIn();
    const b = await api.createBooking(input());
    const restarted = createLocalService({ now });
    expect((await restarted.getSession())?.email).toBe(DEMO_EMAIL);
    expect((await restarted.getBooking(b.id)).reference).toBe(b.reference);
  });
});
