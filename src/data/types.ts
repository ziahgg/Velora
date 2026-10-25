import type { ISODate } from '@/lib/dates';
import type { Cents } from '@/lib/money';

/** Where a photo comes from: a bundled asset key (see src/data/photos.ts) or a remote URL. */
export type PhotoRef = string;

export interface Destination {
  id: string;
  name: string;
  country: string;
  /** Short editorial blurb shown on the destination screen. */
  blurb: string;
  photo: PhotoRef;
  /** Areas inside the destination ("Uluwatu", "Ubud"…), used as filter chips. */
  areas: string[];
  /** Coordinates of the destination centre (used by the map view). */
  lat: number;
  lng: number;
}

export type PropertyType = 'villa' | 'resort' | 'hotel' | 'apartment';

export interface Amenity {
  id: string;
  label: string;
  /** Lucide icon key (see components/Icon). */
  icon: string;
}

export interface RoomType {
  id: string;
  hotelId: string;
  name: string;
  /** "villa" or "suite" etc. — drives the Villas / Suites filter chips on room selection. */
  category: 'room' | 'suite' | 'villa';
  photo: PhotoRef;
  sizeM2: number;
  bed: string;
  maxGuests: number;
  pricePerNightCents: Cents;
  /** Free cancellation until this many days before check-in; null = non-refundable. */
  freeCancelDays: number | null;
  breakfastIncluded: boolean;
  features: string[];
  /** Units of this room type the property can sell per night. */
  inventory: number;
  badge?: string;
}

export interface Hotel {
  id: string;
  destinationId: string;
  name: string;
  area: string;
  address: string;
  /** "25 min to Ngurah Rai Airport · 10 min to Uluwatu Temple" */
  locationNote: string;
  description: string;
  propertyType: PropertyType;
  /** Sample ratings for development data — not real guest reviews. */
  rating: number;
  reviewCount: number;
  photos: PhotoRef[];
  amenityIds: string[];
  /** Tags shown on cards, e.g. "Private pool". */
  highlights: string[];
  checkInTime: string;
  checkOutTime: string;
  resortFeePerNightCents: Cents;
  /** Tax rate in basis points (1000 = 10%). */
  taxRateBps: number;
  lat: number;
  lng: number;
  rooms: RoomType[];
  /** Lowest nightly room price — computed from rooms. */
  fromPriceCents: Cents;
}

export interface Catalog {
  destinations: Destination[];
  hotels: Hotel[];
  amenities: Amenity[];
  /** True when this data is the bundled development seed, not a live inventory source. */
  isSampleData: boolean;
}

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  notificationsEnabled: boolean;
  currency: 'USD';
}

export interface SessionUser {
  id: string;
  email: string;
}

export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'expired';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'voided';

export interface PriceQuote {
  nights: number;
  rooms: number;
  nightlyRateCents: Cents;
  subtotalCents: Cents;
  taxRateBps: number;
  taxCents: Cents;
  resortFeePerNightCents: Cents;
  feesCents: Cents;
  totalCents: Cents;
}

export interface Booking {
  id: string;
  reference: string;
  userId: string;
  hotelId: string;
  roomTypeId: string;
  checkIn: ISODate;
  checkOut: ISODate;
  adults: number;
  children: number;
  rooms: number;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  specialRequests: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  quote: PriceQuote;
  /** Last day free cancellation applies, or null for non-refundable rates. */
  freeCancelUntil: ISODate | null;
  /** A pending booking holds the room until this instant. */
  holdExpiresAt: string | null;
  /** Display label of the method that paid, e.g. "Mastercard ·· 7890 (sandbox)". */
  paidWith: string | null;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
}

export interface Favorite {
  hotelId: string;
  createdAt: string;
}
