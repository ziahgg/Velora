import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { Price } from '@/components/Cards';
import { DevNote, EmptyState, ErrorState, FullScreenLoader, SkeletonCard, useToast } from '@/components/Feedback';
import { Icon } from '@/components/Icon';
import { AppBar, Screen } from '@/components/Layout';
import { Photo } from '@/components/Photo';
import { Tag, TagRow } from '@/components/Pills';
import { Txt } from '@/components/Text';
import type { RoomType } from '@/data/types';
import { DatesGuestsSheet } from '@/features/search/DatesGuestsSheet';
import { formatShort, nightsBetween, plural } from '@/lib/dates';
import { stayShort } from '@/lib/format';
import { formatUSDShort } from '@/lib/money';
import { fitsParty, freeCancelUntil, quoteStay } from '@/lib/pricing';
import { useAvailability, useCatalog, useCatalogIndex } from '@/state/queries';
import { useSearch } from '@/state/search';
import { errorMessage } from '@/state/session';
import { colors } from '@/theme/tokens';

type RoomFilter = 'all' | 'villa' | 'suite' | 'free';

/** Figma 04 Room Selection — prices and availability for the chosen dates and party. */
export default function Rooms() {
  const { id, roomId } = useLocalSearchParams<{ id: string; roomId?: string }>();
  const router = useRouter();
  const toast = useToast();
  const catalog = useCatalog();
  const index = useCatalogIndex(catalog.data);
  const search = useSearch();
  const { stay } = search;
  const hotel = id ? index.hotels.get(id) : undefined;
  const [filter, setFilter] = useState<RoomFilter>('all');
  const [datesOpen, setDatesOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(roomId ?? null);

  const roomIds = useMemo(() => hotel?.rooms.map((r) => r.id) ?? [], [hotel]);
  const availability = useAvailability(roomIds, stay.checkIn, stay.checkOut, !!hotel);
  const nights = nightsBetween(stay.checkIn, stay.checkOut);

  const bookable = (r: RoomType) => fitsParty(r.maxGuests, stay) && (availability.data?.[r.id] ?? 0) >= stay.rooms;
  // Default to the first bookable room once availability is known.
  const selectedId = picked && hotel?.rooms.some((r) => r.id === picked && bookable(r)) ? picked : hotel?.rooms.find(bookable)?.id ?? null;
  const selected = hotel?.rooms.find((r) => r.id === selectedId);

  if (catalog.isPending) return <FullScreenLoader />;
  if (catalog.isError || !hotel) {
    return (
      <Screen>
        <AppBar title="Select room" />
        {catalog.isError ? <ErrorState message={errorMessage(catalog.error)} onRetry={() => void catalog.refetch()} /> : <EmptyState icon="hotel" title="Stay not found" body="This stay is no longer listed." />}
      </Screen>
    );
  }

  const shown = hotel.rooms.filter((r) => (filter === 'all' ? true : filter === 'free' ? r.freeCancelDays !== null : r.category === filter));
  const subtotal = selected ? quoteStay({ nightlyRateCents: selected.pricePerNightCents, checkIn: stay.checkIn, checkOut: stay.checkOut, rooms: stay.rooms, taxRateBps: hotel.taxRateBps, resortFeePerNightCents: hotel.resortFeePerNightCents }).subtotalCents : 0;

  return (
    <Screen
      gap={16}
      footer={
        <Button
          label={selected ? `Continue · ${formatUSDShort(subtotal)} for ${plural(nights, 'night')}` : 'No room available'}
          disabled={!selected}
          onPress={() => selected && router.push({ pathname: '/booking/review', params: { hotelId: hotel.id, roomId: selected.id } })}
        />
      }
    >
      <AppBar title="Select room" action={{ icon: 'sliders', label: filter === 'free' ? 'Show all rooms' : 'Only free cancellation', onPress: () => setFilter(filter === 'free' ? 'all' : 'free') }} />

      <View style={styles.summary}>
        <View style={{ flex: 1, paddingLeft: 10 }}>
          <Txt variant="caption" color="text3" numberOfLines={1}>
            {hotel.name}
          </Txt>
          <Txt variant="label" color="onInk" numberOfLines={1}>
            {stayShort(stay)}
          </Txt>
        </View>
        <IconButton icon="calendar" label="Change dates and guests" look="lime" onPress={() => setDatesOpen(true)} />
      </View>

      <TagRow
        options={[
          { id: 'all', label: 'All rooms' },
          { id: 'villa', label: 'Villas' },
          { id: 'suite', label: 'Suites' },
          { id: 'free', label: 'Free cancellation' },
        ]}
        value={[filter]}
        onChange={(v) => setFilter((v[0] as RoomFilter) ?? 'all')}
      />

      {availability.isError ? (
        <ErrorState message={errorMessage(availability.error)} onRetry={() => void availability.refetch()} />
      ) : availability.isPending ? (
        <SkeletonCard />
      ) : shown.length === 0 ? (
        <EmptyState icon="search-x" title="No rooms of this type" body="Try another room type." action={{ label: 'Show all rooms', onPress: () => setFilter('all') }} />
      ) : (
        shown.map((r) => {
          const fits = fitsParty(r.maxGuests, stay);
          const left = availability.data?.[r.id] ?? 0;
          const soldOut = left < stay.rooms;
          const on = r.id === selectedId;
          const cancelUntil = freeCancelUntil(stay.checkIn, r.freeCancelDays);
          const status = !fits ? `Sleeps ${r.maxGuests} — too small for ${plural(stay.adults + stay.children, 'guest')}` : soldOut ? 'Sold out for these dates' : left <= 2 ? `Only ${left} left for these dates` : null;
          return (
            <View key={r.id} style={[styles.room, on ? styles.roomOn : null, !fits || soldOut ? { opacity: 0.6 } : null]}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: !fits || soldOut }}
              accessibilityLabel={`${r.name}, ${formatUSDShort(r.pricePerNightCents)} per night${status ? `, ${status}` : ''}`}
              onPress={() => (fits && !soldOut ? setPicked(r.id) : toast(status ?? 'Not available', { kind: 'error' }))}
              style={{ gap: 12 }}
            >
              <Photo photo={r.photo} radius={22} style={{ height: 170 }}>
                {r.badge ? (
                  <View style={styles.badge}>
                    <Txt variant="captionMedium" color="ink">
                      {r.badge}
                    </Txt>
                  </View>
                ) : null}
              </Photo>
              <View style={{ paddingHorizontal: 8, gap: 10 }}>
                <View style={styles.head}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="subheading">{r.name}</Txt>
                    <Txt variant="caption" color="text2">
                      {r.sizeM2} m² · {r.bed} · Sleeps {r.maxGuests}
                    </Txt>
                  </View>
                  <Price cents={r.pricePerNightCents} />
                </View>
                <View style={styles.tags}>
                  {r.features.map((f) => (
                    <Tag key={f} label={f} look="filled" size="md" />
                  ))}
                </View>
                {status ? (
                  <Txt variant="caption" color={!fits || soldOut ? 'error' : 'warning'}>
                    {status}
                  </Txt>
                ) : null}
              </View>
            </Pressable>
              <View style={[styles.foot, { paddingHorizontal: 8 }]}>
                  <View style={styles.cancel}>
                    <Icon name={cancelUntil ? 'circle-check' : 'info'} size={16} color={cancelUntil ? 'success' : 'text2'} />
                    <Txt variant="caption" color={cancelUntil ? 'success' : 'text2'} numberOfLines={1} style={{ flexShrink: 1 }}>
                      {cancelUntil ? `Free cancellation until ${formatShort(cancelUntil)}` : 'Non-refundable'}
                    </Txt>
                  </View>
                  <Button label={on ? 'Selected' : 'Select'} size="medium" variant={on ? 'primary' : 'tonal'} disabled={!fits || soldOut} onPress={() => setPicked(r.id)} />
              </View>
            </View>
          );
        })
      )}
      {catalog.data?.isSampleData ? <DevNote text="Demo inventory: room counts and prices are sample data, not real-time availability." /> : null}

      <DatesGuestsSheet
        visible={datesOpen}
        stay={stay}
        onClose={() => setDatesOpen(false)}
        onApply={(s) => {
          search.setStay(s);
          setDatesOpen(false);
          toast(`Dates updated · ${plural(nightsBetween(s.checkIn, s.checkOut), 'night')}`);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ink, borderRadius: 999, padding: 8, paddingLeft: 8, gap: 8 },
  room: { backgroundColor: colors.surface, borderRadius: 30, padding: 8, paddingBottom: 14, gap: 12, borderWidth: 2, borderColor: 'transparent' },
  roomOn: { borderColor: colors.ink },
  badge: { position: 'absolute', top: 12, left: 12, backgroundColor: colors.lime, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cancel: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
});
