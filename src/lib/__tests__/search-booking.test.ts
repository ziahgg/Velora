import { seedCatalog } from '@/data/seed';
import type { Booking } from '@/data/types';
import { cancellationAllowed, canTransition, canTransitionPayment, effectiveStatus, holdsInventory, tripTab } from '../booking';
import { quoteStay } from '../pricing';
import { countActiveFilters, EMPTY_FILTERS, fromPriceFor, searchHotels, suggestPlaces } from '../search';
import { fieldErrors, guestSchema, signUpSchema } from '../validation';

const party = { adults: 2, children: 1, rooms: 1 };
const anywhere = { destinationId: null, area: null, query: '' };

describe('search', () => {
  it('uses the cheapest room that fits the party as the "from" price', () => {
    const gh = seedCatalog.hotels.find((h) => h.id === 'grand-horizon')!;
    expect(fromPriceFor(gh, { adults: 2, children: 0, rooms: 1 })).toBe(44900); // Cliff Suite sleeps 2
    expect(fromPriceFor(gh, party)).toBe(57900); // 3 guests → Ocean View Pool Villa, as in the design
    expect(fromPriceFor(gh, { adults: 6, children: 0, rooms: 1 })).toBeNull();
  });

  it('filters by destination, area and text', () => {
    expect(searchHotels(seedCatalog, { destinationId: 'bali', area: null, query: '' }, party, EMPTY_FILTERS).every((h) => h.destinationId === 'bali')).toBe(true);
    expect(searchHotels(seedCatalog, { destinationId: 'bali', area: 'Ubud', query: '' }, party, EMPTY_FILTERS).map((h) => h.id)).toEqual(['jungle-mist']);
    expect(searchHotels(seedCatalog, { ...anywhere, query: 'santorini' }, party, EMPTY_FILTERS).every((h) => h.destinationId === 'santorini')).toBe(true);
  });

  it('applies price, rating, type and amenity filters together', () => {
    const r = searchHotels(seedCatalog, anywhere, party, { ...EMPTY_FILTERS, minPriceCents: 40000, maxPriceCents: 70000, minRating: 4.8, propertyTypes: ['villa', 'resort'], amenityIds: ['private-pool'] });
    expect(r.length).toBeGreaterThan(0);
    for (const h of r) {
      const from = fromPriceFor(h, party)!;
      expect(from).toBeGreaterThanOrEqual(40000);
      expect(from).toBeLessThanOrEqual(70000);
      expect(h.rating).toBeGreaterThanOrEqual(4.8);
      expect(['villa', 'resort']).toContain(h.propertyType);
      expect(h.amenityIds).toContain('private-pool');
    }
  });

  it('sorts by price and rating, with stable unique results', () => {
    const asc = searchHotels(seedCatalog, anywhere, party, { ...EMPTY_FILTERS, sort: 'price_asc' }).map((h) => fromPriceFor(h, party)!);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = searchHotels(seedCatalog, anywhere, party, { ...EMPTY_FILTERS, sort: 'price_desc' }).map((h) => fromPriceFor(h, party)!);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    const rated = searchHotels(seedCatalog, anywhere, party, { ...EMPTY_FILTERS, sort: 'rating' });
    expect(rated[0].rating).toBe(Math.max(...rated.map((h) => h.rating)));
    expect(new Set(rated.map((h) => h.id)).size).toBe(rated.length);
  });

  it('hides hotels with no room for the party', () => {
    const big = { adults: 5, children: 0, rooms: 1 };
    expect(searchHotels(seedCatalog, anywhere, big, EMPTY_FILTERS).map((h) => h.id)).toEqual(['grand-horizon']);
  });

  it('suggests destinations, areas and stays', () => {
    expect(suggestPlaces(seedCatalog, 'ubu')[0]).toMatchObject({ label: 'Ubud, Bali', sub: 'Area' });
    expect(suggestPlaces(seedCatalog, 'mald')[0].label).toBe('Maldives, Maldives');
    expect(suggestPlaces(seedCatalog, '')).toEqual([]);
  });

  it('counts active filters', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, minPriceCents: 100, minRating: 4.5, amenityIds: ['spa', 'wifi'] })).toBe(4);
  });
});

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    reference: 'VLR-48217',
    userId: 'u1',
    hotelId: 'grand-horizon',
    roomTypeId: 'gh-ocean-villa',
    checkIn: '2026-11-12',
    checkOut: '2026-11-16',
    adults: 2,
    children: 1,
    rooms: 1,
    guestName: 'Ziah',
    guestPhone: '+62 852 3239 6140',
    guestEmail: 'ziah@velora.travel',
    specialRequests: '',
    status: 'confirmed',
    paymentStatus: 'paid',
    quote: quoteStay({ nightlyRateCents: 57900, checkIn: '2026-11-12', checkOut: '2026-11-16', rooms: 1, taxRateBps: 1000, resortFeePerNightCents: 2500 }),
    freeCancelUntil: '2026-11-10',
    holdExpiresAt: null,
    paidWith: 'Mastercard ·· 4444 (sandbox)',
    createdAt: '2026-10-25T10:00:00Z',
    confirmedAt: '2026-10-25T10:01:00Z',
    cancelledAt: null,
    ...over,
  };
}

describe('booking status', () => {
  it('only allows explicit transitions', () => {
    expect(canTransition('pending_payment', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'cancelled')).toBe(true);
    expect(canTransition('cancelled', 'confirmed')).toBe(false);
    expect(canTransition('expired', 'confirmed')).toBe(false);
    expect(canTransitionPayment('failed', 'paid')).toBe(true);
    expect(canTransitionPayment('paid', 'failed')).toBe(false);
    expect(canTransitionPayment('voided', 'paid')).toBe(false);
  });

  it('expires pending holds and releases their inventory', () => {
    const now = new Date('2026-10-25T10:20:00Z');
    const pending = booking({ status: 'pending_payment', paymentStatus: 'unpaid', holdExpiresAt: '2026-10-25T10:15:00Z' });
    expect(effectiveStatus(pending, now)).toBe('expired');
    expect(holdsInventory(pending, now)).toBe(false);
    expect(holdsInventory({ ...pending, holdExpiresAt: '2026-10-25T10:30:00Z' }, now)).toBe(true);
  });

  it('puts bookings on the right My Trips tab', () => {
    expect(tripTab(booking(), '2026-10-25')).toBe('upcoming');
    expect(tripTab(booking(), '2026-11-16')).toBe('completed');
    expect(tripTab(booking({ status: 'cancelled' }), '2026-10-25')).toBe('cancelled');
  });

  it('applies the cancellation policy', () => {
    expect(cancellationAllowed(booking(), '2026-11-01')).toEqual({ allowed: true, refundable: true });
    expect(cancellationAllowed(booking(), '2026-11-11')).toEqual({ allowed: true, refundable: false });
    expect(cancellationAllowed(booking(), '2026-11-12').allowed).toBe(false);
    expect(cancellationAllowed(booking({ freeCancelUntil: null }), '2026-11-01').refundable).toBe(false);
    expect(cancellationAllowed(booking({ status: 'cancelled' }), '2026-11-01').allowed).toBe(false);
  });
});

describe('validation', () => {
  it('validates guest details', () => {
    expect(fieldErrors(guestSchema, { guestName: 'Ziah Makmur', guestPhone: '+62 852 3239 6140', specialRequests: '' })).toEqual({});
    expect(fieldErrors(guestSchema, { guestName: 'Z', guestPhone: 'call me', specialRequests: '' })).toMatchObject({ guestName: expect.any(String), guestPhone: expect.any(String) });
  });

  it('validates sign-up', () => {
    const e = fieldErrors(signUpSchema, { fullName: 'Ziah', email: 'ziah@velora', password: 'password', acceptTerms: false });
    expect(e.email).toMatch(/valid email/);
    expect(e.password).toMatch(/number/);
    expect(e.acceptTerms).toBeTruthy();
  });
});
