import type { ISODate } from '@/lib/dates';
import type { Booking, Catalog, Favorite, Profile, SessionUser } from './types';

export type ErrorCode =
  | 'auth'
  | 'invalid_credentials'
  | 'email_taken'
  | 'not_found'
  | 'validation'
  | 'unavailable'
  | 'capacity'
  | 'price_changed'
  | 'hold_expired'
  | 'payment_declined'
  | 'forbidden'
  | 'network'
  | 'not_supported'
  | 'unknown';

/** Errors the UI can show as-is. Never contains secrets, tokens or card data. */
export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = 'unknown',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export interface CreateBookingInput {
  hotelId: string;
  roomTypeId: string;
  checkIn: ISODate;
  checkOut: ISODate;
  adults: number;
  children: number;
  rooms: number;
  guestName: string;
  guestPhone: string;
  specialRequests: string;
  /** The total the guest was shown; the backend rejects the booking if its own price differs. */
  expectedTotalCents: number;
  /** One key per review screen visit, so a double tap or retry can't create two bookings. */
  idempotencyKey: string;
}

/** What the payment adapter reports back; the backend records it and confirms the booking. */
export interface PaymentResult {
  status: 'succeeded' | 'declined';
  provider: 'sandbox';
  providerReference: string;
  methodLabel: string;
  declineReason?: string;
}

export interface DataService {
  /** "supabase" or "demo" — shown in Profile so testers know which backend they are using. */
  readonly mode: 'supabase' | 'demo';

  // Auth
  getSession(): Promise<SessionUser | null>;
  onAuthChange(listener: (user: SessionUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<SessionUser>;
  signUp(input: { fullName: string; email: string; password: string }): Promise<{ user: SessionUser | null; needsEmailConfirmation: boolean }>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /** Turns the code from a password-reset link into a short-lived session. */
  exchangeRecoveryCode(code: string): Promise<void>;
  updatePassword(password: string): Promise<void>;

  // Catalog (public)
  getCatalog(): Promise<Catalog>;
  /** Units of a room type still sellable for every night of the stay. */
  getAvailability(roomTypeIds: string[], checkIn: ISODate, checkOut: ISODate): Promise<Record<string, number>>;

  // Private, per user
  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Pick<Profile, 'fullName' | 'phone' | 'notificationsEnabled'>>): Promise<Profile>;
  listFavorites(): Promise<Favorite[]>;
  setFavorite(hotelId: string, saved: boolean): Promise<void>;
  listBookings(): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking>;
  /** Prices the stay on the trusted side, holds inventory and returns a pending booking. */
  createBooking(input: CreateBookingInput): Promise<Booking>;
  /** Records a payment result. Succeeded → booking confirmed; declined → stays pending. */
  recordPayment(bookingId: string, result: PaymentResult, idempotencyKey: string): Promise<Booking>;
  cancelBooking(bookingId: string): Promise<Booking>;
}
