import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';

import { IconButton } from '@/components/Button';
import { TripCard } from '@/components/Cards';
import { EmptyState, ErrorState, SkeletonCard, useToast } from '@/components/Feedback';
import { PageTitle, Screen } from '@/components/Layout';
import { Segmented } from '@/components/Pills';
import { Txt } from '@/components/Text';
import type { Booking } from '@/data/types';
import { daysUntil, effectiveStatus, tripTab, type TripTab } from '@/lib/booking';
import { formatRange, plural, todayISO } from '@/lib/dates';
import { guestsLabel } from '@/lib/format';
import { useBookings, useCatalog, useCatalogIndex } from '@/state/queries';
import { errorMessage } from '@/state/session';

/** Figma 14 My Trips — bookings from the backend, grouped by status. */
export default function Trips() {
  const router = useRouter();
  const toast = useToast();
  const bookings = useBookings();
  const catalog = useCatalog();
  const index = useCatalogIndex(catalog.data);
  const [tab, setTab] = useState<TripTab>('upcoming');
  const today = todayISO();

  const groups = useMemo(() => {
    const g: Record<TripTab, Booking[]> = { upcoming: [], completed: [], cancelled: [] };
    for (const b of bookings.data ?? []) {
      const t = tripTab(b, today);
      if (t) g[t].push(b);
    }
    g.upcoming.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    g.completed.sort((a, b) => b.checkOut.localeCompare(a.checkOut));
    g.cancelled.sort((a, b) => (b.cancelledAt ?? '').localeCompare(a.cancelledAt ?? ''));
    return g;
  }, [bookings.data, today]);

  const list = groups[tab];
  const directions = (b: Booking) => {
    const h = index.hotels.get(b.hotelId);
    if (!h) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`).catch(() => toast('Couldn’t open maps.', { kind: 'error', aboveNav: true }));
  };

  return (
    <Screen withNav gap={16} onRefresh={() => void bookings.refetch()} refreshing={bookings.isRefetching}>
      <PageTitle title="My Trips" action={<IconButton icon="plus" label="Plan a new trip" look="ink" onPress={() => router.navigate('/search')} />} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'completed', label: 'Completed' },
          { id: 'cancelled', label: 'Cancelled' },
        ]}
      />

      {bookings.isPending || catalog.isPending ? (
        <SkeletonCard />
      ) : bookings.isError ? (
        <ErrorState message={errorMessage(bookings.error)} onRetry={() => void bookings.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="luggage"
          title={tab === 'upcoming' ? 'No upcoming trips' : tab === 'completed' ? 'No past trips yet' : 'No cancelled trips'}
          body={tab === 'upcoming' ? 'When you book a stay, your voucher and check-in details live here.' : 'Trips will show up here once they apply.'}
          action={tab === 'upcoming' ? { label: 'Find a stay', onPress: () => router.navigate('/search') } : undefined}
        />
      ) : (
        <View style={{ gap: 16 }}>
          {list.map((b) => {
            const hotel = index.hotels.get(b.hotelId);
            const room = index.room(b.hotelId, b.roomTypeId);
            const status = effectiveStatus(b);
            const pending = status === 'pending_payment';
            const days = daysUntil(b.checkIn, today);
            return (
              <TripCard
                key={b.id}
                photo={hotel?.photos[0] ?? ''}
                countdown={tab === 'upcoming' ? (pending ? 'Payment due' : days <= 0 ? 'Checking in today' : `In ${plural(days, 'day')}`) : undefined}
                title={hotel?.name ?? 'Stay'}
                subtitle={`${room?.name ?? 'Room'} · ${b.reference}`}
                status={status === 'confirmed' ? { label: tab === 'completed' ? 'Completed' : 'Confirmed', tone: 'ink' } : pending ? { label: 'Unpaid', tone: 'lime' } : { label: 'Cancelled', tone: 'outline' }}
                facts={[formatRange(b.checkIn, b.checkOut), plural(b.quote.nights, 'night'), guestsLabel(b)]}
                primary={
                  pending
                    ? { label: 'Complete payment', onPress: () => router.push({ pathname: '/booking/payment', params: { bookingId: b.id } }) }
                    : { label: 'View voucher', onPress: () => router.push(`/trip/${b.id}`) }
                }
                secondary={tab === 'upcoming' && !pending ? { label: 'Directions', onPress: () => directions(b) } : undefined}
                onPress={() => router.push(`/trip/${b.id}`)}
              />
            );
          })}
        </View>
      )}
      {catalog.data?.isSampleData && list.length ? (
        <Txt variant="caption" color="text3" align="center">
          Bookings in demo mode are stored on this device only.
        </Txt>
      ) : null}
    </Screen>
  );
}
