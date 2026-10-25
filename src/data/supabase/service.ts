import type { PostgrestError } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { buildHotel } from '../seed';
import { AppError, type DataService, type ErrorCode } from '../service';
import type { Amenity, Booking, Catalog, Destination, Hotel, Profile, SessionUser } from '../types';
import { getSupabase } from './client';

type Row = Record<string, any>;

const CODES: ErrorCode[] = ['auth', 'not_found', 'validation', 'unavailable', 'capacity', 'price_changed', 'hold_expired', 'forbidden', 'not_supported'];

/** Database functions raise "<code>: <message>"; turn those into AppErrors the UI can show. */
function fail(error: PostgrestError | { message: string } | null): never {
  const msg = error?.message ?? 'Something went wrong';
  const m = msg.match(/^([a-z_]+):\s*(.+)$/);
  if (m && (CODES as string[]).includes(m[1])) {
    const text = m[2].charAt(0).toUpperCase() + m[2].slice(1);
    throw new AppError(text.endsWith('.') ? text : `${text}.`, m[1] as ErrorCode);
  }
  if (/JWT|not authenticated|Auth session missing/i.test(msg)) throw new AppError('Your session has ended. Sign in again.', 'auth');
  if (/row-level security|permission denied|42501/i.test(msg)) throw new AppError('You don’t have access to this.', 'forbidden');
  if (/Failed to fetch|Network request failed|NetworkError|fetch failed/i.test(msg)) throw new AppError('You’re offline. Check your connection and try again.', 'network');
  throw new AppError('Something went wrong. Please try again.', 'unknown');
}

function check<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) fail(res.error);
  if (res.data === null || res.data === undefined) throw new AppError('Not found.', 'not_found');
  return res.data as NonNullable<T>;
}

function ok(res: { error: PostgrestError | null }): void {
  if (res.error) fail(res.error);
}

const toUser = (u: { id: string; email?: string | null }): SessionUser => ({ id: u.id, email: u.email ?? '' });

const mapProfile = (r: Row): Profile => ({
  id: r.id,
  email: r.email,
  fullName: r.full_name,
  phone: r.phone,
  notificationsEnabled: r.notifications_enabled,
  currency: 'USD',
});

export const mapBooking = (r: Row): Booking => ({
  id: r.id,
  reference: r.reference,
  userId: r.user_id,
  hotelId: r.hotel_id,
  roomTypeId: r.room_type_id,
  checkIn: r.check_in,
  checkOut: r.check_out,
  adults: r.adults,
  children: r.children,
  rooms: r.rooms,
  guestName: r.guest_name,
  guestPhone: r.guest_phone,
  guestEmail: r.guest_email,
  specialRequests: r.special_requests,
  status: r.status,
  paymentStatus: r.payment_status,
  quote: {
    nights: r.nights,
    rooms: r.rooms,
    nightlyRateCents: Number(r.nightly_rate_cents),
    subtotalCents: Number(r.subtotal_cents),
    taxRateBps: r.tax_rate_bps,
    taxCents: Number(r.tax_cents),
    resortFeePerNightCents: Number(r.resort_fee_per_night_cents),
    feesCents: Number(r.fees_cents),
    totalCents: Number(r.total_cents),
  },
  freeCancelUntil: r.free_cancel_until,
  holdExpiresAt: r.hold_expires_at,
  paidWith: r.paid_with,
  createdAt: r.created_at,
  confirmedAt: r.confirmed_at,
  cancelledAt: r.cancelled_at,
});

/** Supabase-backed implementation (Auth, Postgres with RLS, security-definer functions). */
export function createSupabaseService(): DataService {
  const sb = getSupabase();

  async function requireUserId(): Promise<string> {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new AppError('Your session has ended. Sign in again.', 'auth');
    return id;
  }

  return {
    mode: 'supabase',

    async getSession() {
      const { data } = await sb.auth.getSession();
      return data.session ? toUser(data.session.user) : null;
    },

    onAuthChange(listener) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => listener(session ? toUser(session.user) : null));
      return () => data.subscription.unsubscribe();
    },

    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        if (/invalid login credentials/i.test(error.message)) throw new AppError('Incorrect email or password.', 'invalid_credentials');
        if (/email not confirmed/i.test(error.message)) throw new AppError('Confirm your email first — check your inbox for the link.', 'auth');
        fail(error);
      }
      return toUser(data.user);
    },

    async signUp({ fullName, email, password }) {
      const { data, error } = await sb.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) {
        if (/already registered|already exists/i.test(error.message)) throw new AppError('An account with this email already exists. Sign in instead.', 'email_taken');
        if (/password/i.test(error.message)) throw new AppError(error.message, 'validation');
        fail(error);
      }
      return { user: data.session ? toUser(data.session.user) : null, needsEmailConfirmation: !data.session };
    },

    async signOut() {
      const { error } = await sb.auth.signOut();
      if (error) fail(error);
    },

    async sendPasswordReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: Linking.createURL('/reset-password') });
      if (error) fail(error);
    },

    async exchangeRecoveryCode(code) {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) throw new AppError('This reset link has expired or was already used. Request a new one.', 'auth');
    },

    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) {
        if (/should be different|same/i.test(error.message)) throw new AppError('Choose a password you haven’t used before.', 'validation');
        fail(error);
      }
    },

    async getCatalog(): Promise<Catalog> {
      const [dest, amen, hotels, images, ha, rooms] = await Promise.all([
        sb.from('destinations').select('*').order('sort_order'),
        sb.from('amenities').select('*'),
        sb.from('hotels').select('*').order('sort_order'),
        sb.from('hotel_images').select('*').order('position'),
        sb.from('hotel_amenities').select('*'),
        sb.from('room_types').select('*').order('sort_order'),
      ]);
      const d = check(dest);
      const a = check(amen);
      const h = check(hotels);
      const im = check(images);
      const am = check(ha);
      const r = check(rooms);
      const destinations: Destination[] = d.map((x: Row) => ({ id: x.id, name: x.name, country: x.country, blurb: x.blurb, photo: x.photo, areas: x.areas, lat: x.lat, lng: x.lng }));
      const amenities: Amenity[] = a.map((x: Row) => ({ id: x.id, label: x.label, icon: x.icon }));
      const built: Hotel[] = h
        .map((x: Row) =>
          buildHotel({
            id: x.id,
            destinationId: x.destination_id,
            name: x.name,
            area: x.area,
            address: x.address,
            locationNote: x.location_note,
            description: x.description,
            propertyType: x.property_type,
            rating: Number(x.rating),
            reviewCount: x.review_count,
            photos: im.filter((p: Row) => p.hotel_id === x.id).map((p: Row) => p.photo),
            amenityIds: am.filter((p: Row) => p.hotel_id === x.id).map((p: Row) => p.amenity_id),
            highlights: x.highlights,
            checkInTime: x.check_in_time,
            checkOutTime: x.check_out_time,
            resortFeePerNightCents: x.resort_fee_per_night_cents,
            taxRateBps: x.tax_rate_bps,
            lat: x.lat,
            lng: x.lng,
            rooms: r
              .filter((y: Row) => y.hotel_id === x.id)
              .map((y: Row) => ({
                id: y.id,
                name: y.name,
                category: y.category,
                photo: y.photo,
                sizeM2: y.size_m2,
                bed: y.bed,
                maxGuests: y.max_guests,
                pricePerNightCents: y.price_per_night_cents,
                freeCancelDays: y.free_cancel_days,
                breakfastIncluded: y.breakfast_included,
                features: y.features,
                inventory: y.inventory,
                badge: y.badge ?? undefined,
              })),
          }),
        )
        .filter((x: Hotel) => x.rooms.length > 0);
      return { destinations, amenities, hotels: built, isSampleData: h.some((x: Row) => x.is_sample) };
    },

    async getAvailability(roomTypeIds, checkIn, checkOut) {
      const rows = check(await sb.rpc('room_availability', { p_room_type_ids: roomTypeIds, p_check_in: checkIn, p_check_out: checkOut }));
      return Object.fromEntries((rows as Row[]).map((x) => [x.room_type_id, x.available]));
    },

    async getProfile() {
      const id = await requireUserId();
      return mapProfile(check(await sb.from('profiles').select('*').eq('id', id).single()));
    },

    async updateProfile(patch) {
      const id = await requireUserId();
      const row: Row = {};
      if (patch.fullName !== undefined) row.full_name = patch.fullName.trim();
      if (patch.phone !== undefined) row.phone = patch.phone.trim();
      if (patch.notificationsEnabled !== undefined) row.notifications_enabled = patch.notificationsEnabled;
      return mapProfile(check(await sb.from('profiles').update(row).eq('id', id).select('*').single()));
    },

    async listFavorites() {
      const rows = check(await sb.from('favorites').select('hotel_id, created_at').order('created_at', { ascending: false }));
      return rows.map((x: Row) => ({ hotelId: x.hotel_id, createdAt: x.created_at }));
    },

    async setFavorite(hotelId, saved) {
      const userId = await requireUserId();
      if (saved) ok(await sb.from('favorites').upsert({ user_id: userId, hotel_id: hotelId }, { onConflict: 'user_id,hotel_id', ignoreDuplicates: true }));
      else ok(await sb.from('favorites').delete().eq('user_id', userId).eq('hotel_id', hotelId));
    },

    async listBookings() {
      const rows = check(await sb.from('bookings').select('*').order('created_at', { ascending: false }));
      return rows.map(mapBooking);
    },

    async getBooking(id) {
      return mapBooking(check(await sb.from('bookings').select('*').eq('id', id).maybeSingle()));
    },

    async createBooking(input) {
      const row = check(
        await sb
          .rpc('create_booking', {
            p_hotel_id: input.hotelId,
            p_room_type_id: input.roomTypeId,
            p_check_in: input.checkIn,
            p_check_out: input.checkOut,
            p_adults: input.adults,
            p_children: input.children,
            p_rooms: input.rooms,
            p_guest_name: input.guestName,
            p_guest_phone: input.guestPhone,
            p_special_requests: input.specialRequests,
            p_expected_total_cents: input.expectedTotalCents,
            p_idempotency_key: input.idempotencyKey,
          })
          .single(),
      );
      return mapBooking(row as Row);
    },

    async recordPayment(bookingId, result, idempotencyKey) {
      const row = check(
        await sb
          .rpc('record_sandbox_payment', {
            p_booking_id: bookingId,
            p_outcome: result.status === 'succeeded' ? 'succeeded' : 'declined',
            p_method_label: result.methodLabel,
            p_provider_reference: result.providerReference,
            p_idempotency_key: idempotencyKey,
          })
          .single(),
      );
      return mapBooking(row as Row);
    },

    async cancelBooking(bookingId) {
      return mapBooking(check(await sb.rpc('cancel_booking', { p_booking_id: bookingId }).single()) as Row);
    },
  };
}
