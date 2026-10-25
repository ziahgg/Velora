import type { Catalog, Destination, Hotel, PropertyType } from '@/data/types';
import { fitsParty, type StayInput } from './pricing';

export type SortKey = 'recommended' | 'price_asc' | 'price_desc' | 'rating';

export interface Filters {
  minPriceCents: number | null;
  maxPriceCents: number | null;
  minRating: number | null;
  propertyTypes: PropertyType[];
  amenityIds: string[];
  sort: SortKey;
}

export const EMPTY_FILTERS: Filters = {
  minPriceCents: null,
  maxPriceCents: null,
  minRating: null,
  propertyTypes: [],
  amenityIds: [],
  sort: 'recommended',
};

/** Where to search: a destination, a free-text query, or everywhere. */
export interface Place {
  destinationId: string | null;
  area: string | null;
  query: string;
}

export const SORT_LABEL: Record<SortKey, string> = {
  recommended: 'Recommended',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  rating: 'Top rated',
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Text match against hotel name, area, destination and country. */
export function matchesQuery(hotel: Hotel, destination: Destination | undefined, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  const hay = norm([hotel.name, hotel.area, destination?.name ?? '', destination?.country ?? '', hotel.highlights.join(' ')].join(' '));
  return q.split(/\s+/).every((word) => hay.includes(word));
}

/** "Recommended" blends rating and review volume so a 5.0 with 3 reviews doesn't win. */
export function recommendScore(h: Hotel): number {
  return h.rating * 10 + Math.log10(1 + h.reviewCount);
}

type Party = Pick<StayInput, 'adults' | 'children' | 'rooms'>;

/** Lowest nightly price among rooms that fit the party, or null when no room fits. */
export function fromPriceFor(hotel: Hotel, party: Party): number | null {
  const prices = hotel.rooms.filter((r) => fitsParty(r.maxGuests, party)).map((r) => r.pricePerNightCents);
  return prices.length ? Math.min(...prices) : null;
}

/** The single search used by Search Results, the map view, destination pages and the filter count. */
export function searchHotels(catalog: Catalog, place: Place, stay: Party, filters: Filters): Hotel[] {
  const byId = new Map(catalog.destinations.map((d) => [d.id, d]));
  const price = new Map(catalog.hotels.map((h) => [h.id, fromPriceFor(h, stay)]));
  const results = catalog.hotels.filter((h) => {
    const from = price.get(h.id);
    if (place.destinationId && h.destinationId !== place.destinationId) return false;
    if (place.area && h.area !== place.area) return false;
    if (!matchesQuery(h, byId.get(h.destinationId), place.query)) return false;
    if (from === null || from === undefined) return false;
    if (filters.minPriceCents !== null && from < filters.minPriceCents) return false;
    if (filters.maxPriceCents !== null && from > filters.maxPriceCents) return false;
    if (filters.minRating !== null && h.rating < filters.minRating) return false;
    if (filters.propertyTypes.length && !filters.propertyTypes.includes(h.propertyType)) return false;
    if (filters.amenityIds.some((a) => !h.amenityIds.includes(a))) return false;
    return true;
  });
  const sorted = [...results];
  const p = (h: Hotel) => price.get(h.id) ?? 0;
  switch (filters.sort) {
    case 'price_asc':
      sorted.sort((a, b) => p(a) - p(b) || a.name.localeCompare(b.name));
      break;
    case 'price_desc':
      sorted.sort((a, b) => p(b) - p(a) || a.name.localeCompare(b.name));
      break;
    case 'rating':
      sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
      break;
    default:
      sorted.sort((a, b) => recommendScore(b) - recommendScore(a) || a.name.localeCompare(b.name));
  }
  return sorted;
}

/** Suggestions for the search field: destinations and areas whose name matches. */
export function suggestPlaces(catalog: Catalog, query: string, limit = 6): { label: string; sub: string; place: Place }[] {
  const q = norm(query);
  if (!q) return [];
  const out: { label: string; sub: string; place: Place }[] = [];
  for (const d of catalog.destinations) {
    if (norm(`${d.name} ${d.country}`).includes(q)) out.push({ label: `${d.name}, ${d.country}`, sub: 'Destination', place: { destinationId: d.id, area: null, query: '' } });
    for (const a of d.areas) {
      if (norm(a).includes(q)) out.push({ label: `${a}, ${d.name}`, sub: 'Area', place: { destinationId: d.id, area: a, query: '' } });
    }
  }
  for (const h of catalog.hotels) {
    if (norm(h.name).includes(q)) out.push({ label: h.name, sub: `Stay · ${h.area}`, place: { destinationId: null, area: null, query: h.name } });
  }
  return out.slice(0, limit);
}

export function countActiveFilters(f: Filters): number {
  return (
    (f.minPriceCents !== null || f.maxPriceCents !== null ? 1 : 0) +
    (f.minRating !== null ? 1 : 0) +
    f.propertyTypes.length +
    f.amenityIds.length
  );
}

/** Price histogram buckets for the filter sheet (by the party's "from" price). */
export function priceHistogram(hotels: Hotel[], party: Party, minCents: number, maxCents: number, buckets: number): number[] {
  const counts = new Array<number>(buckets).fill(0);
  const span = Math.max(1, maxCents - minCents);
  for (const h of hotels) {
    const from = fromPriceFor(h, party);
    if (from === null) continue;
    const i = Math.min(buckets - 1, Math.max(0, Math.floor(((from - minCents) / span) * buckets)));
    counts[i] += 1;
  }
  return counts;
}
