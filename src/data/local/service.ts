/**
 * On-device demo backend, used when no Supabase project is configured.
 *
 * Data lives in AsyncStorage on this device only and is clearly development
 * data. It applies the same rules as the Supabase functions — trusted-side
 * pricing, capacity and inventory checks, idempotent booking and payment
 * creation, a 15-minute payment hold and explicit status transitions — so the
 * booking flow behaves the same in both modes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { addDays, todayISO } from '@/lib/dates';
import { bookingReference, cancellationAllowed, canTransition, canTransitionPayment, effectiveStatus, HOLD_MINUTES, holdsInventory } from '@/lib/booking';
import { fitsParty, freeCancelUntil, quoteStay, validateStay } from '@/lib/pricing';
import { guestSchema, profileSchema, signUpSchema, newPasswordSchema, fieldErrors } from '@/lib/validation';
import { seedCatalog } from '../seed';
import { AppError, type CreateBookingInput, type DataService, type PaymentResult } from '../service';
import type { Booking, Profile, SessionUser } from '../types';
import { buildLocalDB, DEMO_PASSWORD, type LocalDB } from './db';

const KEY = 'velora.demo.v1';
const LATENCY_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hash = (value: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
const uid = (prefix: string) => `${prefix}-${Crypto.randomUUID()}`;

type StoredBooking = LocalDB['bookings'][number];
const publicBooking = ({ idempotencyKey: _key, ...b }: StoredBooking): Booking => b;

/** Units of a room type still free on every night of [checkIn, checkOut). */
export function availableUnits(d: LocalDB, roomTypeId: string, inventory: number, checkIn: string, checkOut: string, now = new Date(), ignoreBookingId?: string): number {
  const active = d.bookings.filter((b) => b.roomTypeId === roomTypeId && b.id !== ignoreBookingId && holdsInventory(b, now) && b.checkIn < checkOut && checkIn < b.checkOut);
  let worst = 0;
  for (let night = checkIn; night < checkOut; night = addDays(night, 1)) {
    const used = active.filter((b) => b.checkIn <= night && night < b.checkOut).reduce((n, b) => n + b.rooms, 0);
    worst = Math.max(worst, used);
  }
  return Math.max(0, inventory - worst);
}

export function createLocalService(options: { storageKey?: string; now?: () => Date } = {}): DataService {
  const key = options.storageKey ?? KEY;
  const clock = options.now ?? (() => new Date());
  let db: LocalDB | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(u: SessionUser | null) => void>();

  async function load(): Promise<LocalDB> {
    if (db) return db;
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      db = JSON.parse(raw) as LocalDB;
    } else {
      db = buildLocalDB(await hash(DEMO_PASSWORD), clock());
      await AsyncStorage.setItem(key, JSON.stringify(db));
    }
    return db;
  }

  /** Serialises writes so concurrent mutations (e.g. a double tap) can't interleave. */
  function write<T>(fn: (d: LocalDB) => T | Promise<T>): Promise<T> {
    const run = queue.then(async () => {
      await sleep(LATENCY_MS);
      const d = await load();
      const result = await fn(d);
      await AsyncStorage.setItem(key, JSON.stringify(d));
      return result;
    });
    queue = run.catch(() => undefined);
    return run;
  }

  async function read<T>(fn: (d: LocalDB) => T): Promise<T> {
    await sleep(LATENCY_MS);
    return fn(await load());
  }

  function currentUser(d: LocalDB): SessionUser | null {
    const u = d.users.find((x) => x.id === d.sessionUserId);
    return u ? { id: u.id, email: u.email } : null;
  }

  function requireUser(d: LocalDB): SessionUser {
    const u = currentUser(d);
    if (!u) throw new AppError('Your session has ended. Sign in again.', 'auth');
    return u;
  }

  function emit(d: LocalDB) {
    const u = currentUser(d);
    listeners.forEach((l) => l(u));
  }

  function ownBooking(d: LocalDB, userId: string, id: string): StoredBooking {
    const b = d.bookings.find((x) => x.id === id && x.userId === userId);
    if (!b) throw new AppError('We couldn’t find this booking.', 'not_found');
    return b;
  }

  /** Moves holds whose time ran out to "expired" so they stop blocking inventory. */
  function expireHolds(d: LocalDB) {
    const now = clock();
    for (const b of d.bookings) {
      if (b.status === 'pending_payment' && effectiveStatus(b, now) === 'expired') {
        b.status = 'expired';
        b.holdExpiresAt = null;
      }
    }
  }

  function firstError(errors: Partial<Record<string, string>>): string {
    return Object.values(errors)[0] ?? 'Please check your details.';
  }

  return {
    mode: 'demo',

    async getSession() {
      return read(currentUser);
    },

    onAuthChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    signIn(email, password) {
      return write(async (d) => {
        const u = d.users.find((x) => x.email === email.trim().toLowerCase());
        if (!u || u.passwordHash !== (await hash(password))) throw new AppError('Incorrect email or password.', 'invalid_credentials');
        d.sessionUserId = u.id;
        emit(d);
        return { id: u.id, email: u.email };
      });
    },

    signUp(input) {
      return write(async (d) => {
        const errors = fieldErrors(signUpSchema, { ...input, acceptTerms: true });
        if (Object.keys(errors).length) throw new AppError(firstError(errors), 'validation');
        const email = input.email.trim().toLowerCase();
        if (d.users.some((u) => u.email === email)) throw new AppError('An account with this email already exists. Sign in instead.', 'email_taken');
        const id = uid('user');
        d.users.push({ id, email, passwordHash: await hash(input.password) });
        d.profiles.push({ id, email, fullName: input.fullName.trim(), phone: '', notificationsEnabled: true, currency: 'USD' });
        d.sessionUserId = id;
        emit(d);
        return { user: { id, email }, needsEmailConfirmation: false };
      });
    },

    signOut() {
      return write((d) => {
        d.sessionUserId = null;
        emit(d);
      });
    },

    async sendPasswordReset() {
      await sleep(LATENCY_MS);
      throw new AppError('Password reset emails need the Supabase backend. Demo mode can’t send email.', 'not_supported');
    },

    async exchangeRecoveryCode() {
      throw new AppError('Reset links need the Supabase backend.', 'not_supported');
    },

    updatePassword(password) {
      return write(async (d) => {
        const u = requireUser(d);
        const errors = fieldErrors(newPasswordSchema, { password, confirm: password });
        if (Object.keys(errors).length) throw new AppError(firstError(errors), 'validation');
        d.users.find((x) => x.id === u.id)!.passwordHash = await hash(password);
      });
    },

    async getCatalog() {
      await sleep(LATENCY_MS);
      return seedCatalog;
    },

    getAvailability(roomTypeIds, checkIn, checkOut) {
      return read((d) => {
        const out: Record<string, number> = {};
        for (const id of roomTypeIds) {
          const room = seedCatalog.hotels.flatMap((h) => h.rooms).find((r) => r.id === id);
          if (room) out[id] = availableUnits(d, id, room.inventory, checkIn, checkOut, clock());
        }
        return out;
      });
    },

    getProfile() {
      return read((d) => {
        const u = requireUser(d);
        return d.profiles.find((p) => p.id === u.id)!;
      });
    },

    updateProfile(patch) {
      return write((d) => {
        const u = requireUser(d);
        const p = d.profiles.find((x) => x.id === u.id)!;
        const next: Profile = { ...p, ...patch, fullName: (patch.fullName ?? p.fullName).trim(), phone: (patch.phone ?? p.phone).trim() };
        const errors = fieldErrors(profileSchema, next);
        if (Object.keys(errors).length) throw new AppError(firstError(errors), 'validation');
        Object.assign(p, next);
        return { ...p };
      });
    },

    listFavorites() {
      return read((d) => {
        const u = requireUser(d);
        return d.favorites.filter((f) => f.userId === u.id).map(({ hotelId, createdAt }) => ({ hotelId, createdAt }));
      });
    },

    setFavorite(hotelId, saved) {
      return write((d) => {
        const u = requireUser(d);
        if (!seedCatalog.hotels.some((h) => h.id === hotelId)) throw new AppError('This stay is no longer listed.', 'not_found');
        const exists = d.favorites.some((f) => f.userId === u.id && f.hotelId === hotelId);
        if (saved && !exists) d.favorites.unshift({ userId: u.id, hotelId, createdAt: clock().toISOString() });
        if (!saved) d.favorites = d.favorites.filter((f) => !(f.userId === u.id && f.hotelId === hotelId));
      });
    },

    listBookings() {
      return read((d) => {
        const u = requireUser(d);
        return d.bookings.filter((b) => b.userId === u.id).map(publicBooking);
      });
    },

    getBooking(id) {
      return read((d) => publicBooking(ownBooking(d, requireUser(d).id, id)));
    },

    createBooking(input: CreateBookingInput) {
      return write((d) => {
        const u = requireUser(d);
        expireHolds(d);
        const existing = d.bookings.find((b) => b.userId === u.id && b.idempotencyKey === input.idempotencyKey);
        if (existing) return publicBooking(existing);

        const hotel = seedCatalog.hotels.find((h) => h.id === input.hotelId);
        const room = hotel?.rooms.find((r) => r.id === input.roomTypeId);
        if (!hotel || !room) throw new AppError('This room is no longer available.', 'not_found');
        const today = todayISO(clock());
        const stayError = validateStay(input, today);
        if (stayError) throw new AppError(stayError, 'validation');
        if (!fitsParty(room.maxGuests, input)) throw new AppError(`${room.name} sleeps up to ${room.maxGuests} guests per room. Add a room or choose a larger one.`, 'capacity');
        const guestErrors = fieldErrors(guestSchema, input);
        if (Object.keys(guestErrors).length) throw new AppError(firstError(guestErrors), 'validation');
        if (availableUnits(d, room.id, room.inventory, input.checkIn, input.checkOut, clock()) < input.rooms)
          throw new AppError('Sorry — this room just sold out for your dates. Try other dates or another room.', 'unavailable');

        const quote = quoteStay({ nightlyRateCents: room.pricePerNightCents, checkIn: input.checkIn, checkOut: input.checkOut, rooms: input.rooms, taxRateBps: hotel.taxRateBps, resortFeePerNightCents: hotel.resortFeePerNightCents });
        if (quote.totalCents !== input.expectedTotalCents) throw new AppError('The price for this stay has changed. Please review the new total.', 'price_changed');

        const now = clock();
        const profile = d.profiles.find((p) => p.id === u.id)!;
        const booking: StoredBooking = {
          id: uid('bkg'),
          reference: bookingReference(d.nextReference++),
          userId: u.id,
          hotelId: hotel.id,
          roomTypeId: room.id,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          adults: input.adults,
          children: input.children,
          rooms: input.rooms,
          guestName: input.guestName.trim(),
          guestPhone: input.guestPhone.trim(),
          guestEmail: profile.email,
          specialRequests: input.specialRequests.trim(),
          status: 'pending_payment',
          paymentStatus: 'unpaid',
          quote,
          freeCancelUntil: freeCancelUntil(input.checkIn, room.freeCancelDays),
          holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString(),
          paidWith: null,
          createdAt: now.toISOString(),
          confirmedAt: null,
          cancelledAt: null,
          idempotencyKey: input.idempotencyKey,
        };
        d.bookings.unshift(booking);
        return publicBooking(booking);
      });
    },

    recordPayment(bookingId, result: PaymentResult, idempotencyKey) {
      return write((d) => {
        const u = requireUser(d);
        const b = ownBooking(d, u.id, bookingId);
        if (d.payments.some((p) => p.bookingId === bookingId && p.idempotencyKey === idempotencyKey)) return publicBooking(b);
        if (b.status === 'confirmed' && b.paymentStatus === 'paid') return publicBooking(b);
        expireHolds(d);
        if (b.status === 'expired') throw new AppError('Your hold on this room has ended, so no payment was taken. Please book again.', 'hold_expired');
        if (b.status !== 'pending_payment') throw new AppError('This booking can’t be paid any more.', 'validation');

        const status = result.status === 'succeeded' ? 'paid' : 'failed';
        if (!canTransitionPayment(b.paymentStatus, status)) throw new AppError('This payment can’t be recorded.', 'validation');
        d.payments.push({
          id: uid('pay'),
          bookingId,
          userId: u.id,
          provider: result.provider,
          providerReference: result.providerReference,
          status: result.status,
          methodLabel: result.methodLabel,
          amountCents: b.quote.totalCents,
          idempotencyKey,
          createdAt: clock().toISOString(),
        });
        b.paymentStatus = status;
        if (status === 'paid' && canTransition(b.status, 'confirmed')) {
          b.status = 'confirmed';
          b.confirmedAt = clock().toISOString();
          b.holdExpiresAt = null;
          b.paidWith = result.methodLabel;
        }
        return publicBooking(b);
      });
    },

    cancelBooking(bookingId) {
      return write((d) => {
        const u = requireUser(d);
        const b = ownBooking(d, u.id, bookingId);
        expireHolds(d);
        const rule = cancellationAllowed(b, todayISO(clock()), clock());
        if (!rule.allowed) throw new AppError(rule.reason ?? 'This booking can’t be cancelled.', 'validation');
        if (!canTransition(b.status, 'cancelled')) throw new AppError('This booking can’t be cancelled.', 'validation');
        b.status = 'cancelled';
        b.cancelledAt = clock().toISOString();
        b.holdExpiresAt = null;
        // Sandbox only: a refundable paid booking is marked voided — no real money ever moved.
        if (b.paymentStatus === 'paid' && rule.refundable) b.paymentStatus = 'voided';
        return publicBooking(b);
      });
    },
  };
}
