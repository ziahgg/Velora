import type { Amenity, Catalog, Destination, Hotel, RoomType } from '../types';
import raw from './catalog.json';

type RawRoom = Omit<RoomType, 'hotelId' | 'badge'> & { badge?: string };
type RawHotel = Omit<Hotel, 'rooms' | 'fromPriceCents'> & { rooms: RawRoom[] };

/** Builds typed catalog objects from the JSON seed (shared with supabase/seed.sql). */
export function buildHotel(h: RawHotel): Hotel {
  const rooms: RoomType[] = h.rooms.map((r) => ({ ...r, hotelId: h.id }));
  return { ...h, rooms, fromPriceCents: Math.min(...rooms.map((r) => r.pricePerNightCents)) };
}

export const seedCatalog: Catalog = {
  destinations: raw.destinations as Destination[],
  amenities: raw.amenities as Amenity[],
  hotels: (raw.hotels as unknown as RawHotel[]).map(buildHotel),
  isSampleData: true,
};
