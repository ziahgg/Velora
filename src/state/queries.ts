import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { api, type Booking, type Catalog, type Favorite, type Hotel } from '@/data';
import { useSession } from './session';

export const keys = {
  catalog: ['catalog'] as const,
  profile: (uid: string) => ['profile', uid] as const,
  favorites: (uid: string) => ['favorites', uid] as const,
  bookings: (uid: string) => ['bookings', uid] as const,
  booking: (uid: string, id: string) => ['bookings', uid, id] as const,
  availability: (ids: string[], checkIn: string, checkOut: string) => ['availability', ids.join(','), checkIn, checkOut] as const,
};

export function useCatalog() {
  return useQuery({ queryKey: keys.catalog, queryFn: () => api.getCatalog(), staleTime: 10 * 60_000 });
}

/** Lookup helpers over the cached catalog. */
export function useCatalogIndex(catalog: Catalog | undefined) {
  return useMemo(() => {
    const hotels = new Map((catalog?.hotels ?? []).map((h) => [h.id, h]));
    const destinations = new Map((catalog?.destinations ?? []).map((d) => [d.id, d]));
    const amenities = new Map((catalog?.amenities ?? []).map((a) => [a.id, a]));
    const room = (hotelId: string, roomId: string) => hotels.get(hotelId)?.rooms.find((r) => r.id === roomId);
    const place = (h: Hotel) => `${h.area}, ${destinations.get(h.destinationId)?.name ?? ''}`;
    return { hotels, destinations, amenities, room, place };
  }, [catalog]);
}

export function useProfile() {
  const { user } = useSession();
  return useQuery({ queryKey: keys.profile(user?.id ?? ''), queryFn: () => api.getProfile(), enabled: !!user });
}

export function useUpdateProfile() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (p) => qc.setQueryData(keys.profile(user?.id ?? ''), p),
  });
}

export function useFavorites() {
  const { user } = useSession();
  const q = useQuery({ queryKey: keys.favorites(user?.id ?? ''), queryFn: () => api.listFavorites(), enabled: !!user });
  const ids = useMemo(() => new Set((q.data ?? []).map((f) => f.hotelId)), [q.data]);
  return { ...q, ids };
}

/** Optimistic save/unsave shared by every heart in the app; rolls back on failure. */
export function useSetFavorite() {
  const { user } = useSession();
  const qc = useQueryClient();
  const key = keys.favorites(user?.id ?? '');
  return useMutation({
    mutationFn: ({ hotelId, saved }: { hotelId: string; saved: boolean }) => api.setFavorite(hotelId, saved),
    onMutate: async ({ hotelId, saved }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Favorite[]>(key);
      qc.setQueryData<Favorite[]>(key, (list = []) =>
        saved ? [{ hotelId, createdAt: new Date().toISOString() }, ...list.filter((f) => f.hotelId !== hotelId)] : list.filter((f) => f.hotelId !== hotelId),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useBookings() {
  const { user } = useSession();
  return useQuery({ queryKey: keys.bookings(user?.id ?? ''), queryFn: () => api.listBookings(), enabled: !!user });
}

export function useBooking(id: string | undefined) {
  const { user } = useSession();
  const qc = useQueryClient();
  return useQuery({
    queryKey: keys.booking(user?.id ?? '', id ?? ''),
    queryFn: () => api.getBooking(id!),
    enabled: !!user && !!id,
    initialData: () => qc.getQueryData<Booking[]>(keys.bookings(user?.id ?? ''))?.find((b) => b.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(keys.bookings(user?.id ?? ''))?.dataUpdatedAt,
  });
}

/** Writes a booking returned by the backend into the cache (list + detail). */
export function useStoreBooking() {
  const { user } = useSession();
  const qc = useQueryClient();
  return (b: Booking) => {
    const uid = user?.id ?? '';
    qc.setQueryData(keys.booking(uid, b.id), b);
    qc.setQueryData<Booking[]>(keys.bookings(uid), (list) => (list ? [b, ...list.filter((x) => x.id !== b.id)] : list));
    void qc.invalidateQueries({ queryKey: ['availability'] });
  };
}

export function useAvailability(roomTypeIds: string[], checkIn: string, checkOut: string, enabled = true) {
  return useQuery({
    queryKey: keys.availability(roomTypeIds, checkIn, checkOut),
    queryFn: () => api.getAvailability(roomTypeIds, checkIn, checkOut),
    enabled: enabled && roomTypeIds.length > 0 && checkOut > checkIn,
    staleTime: 15_000,
  });
}
