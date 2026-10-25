import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BrandMark } from '@/components/Brand';
import { IconButton } from '@/components/Button';
import { DestinationCard, HotelCard, StayRow } from '@/components/Cards';
import { DevNote, ErrorState, Skeleton, useToast } from '@/components/Feedback';
import { SearchField } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Screen, SectionHeader } from '@/components/Layout';
import { CategoryChip } from '@/components/Pills';
import { Txt } from '@/components/Text';
import { useFavoriteToggle } from '@/features/favorites/useFavoriteToggle';
import { deriveReminders, RemindersSheet } from '@/features/home/RemindersSheet';
import { FiltersSheet } from '@/features/search/FiltersSheet';
import { DatesGuestsSheet } from '@/features/search/DatesGuestsSheet';
import { nightsBetween, plural } from '@/lib/dates';
import { firstName, guestsLabel, staySummary } from '@/lib/format';
import { fromPriceFor, recommendScore, searchHotels } from '@/lib/search';
import { useBookings, useCatalog, useCatalogIndex, useProfile } from '@/state/queries';
import { useSearch } from '@/state/search';
import { errorMessage } from '@/state/session';
import { colors, SIDE } from '@/theme/tokens';

/** Figma 01 Home. */
export default function Home() {
  const router = useRouter();
  const toast = useToast();
  const catalog = useCatalog();
  const index = useCatalogIndex(catalog.data);
  const profile = useProfile();
  const bookings = useBookings();
  const search = useSearch();
  const fav = useFavoriteToggle({ aboveNav: true });
  const [datesOpen, setDatesOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);

  const reminders = useMemo(() => deriveReminders(bookings.data ?? [], index.hotels), [bookings.data, index.hotels]);
  const recommended = useMemo(() => {
    const hotels = catalog.data?.hotels ?? [];
    return [...hotels].filter((h) => fromPriceFor(h, search.stay) !== null).sort((a, b) => recommendScore(b) - recommendScore(a)).slice(0, 6);
  }, [catalog.data, search.stay]);
  const popular = useMemo(() => {
    if (!catalog.data) return [];
    const dest = search.place.destinationId ?? 'bali';
    return searchHotels(catalog.data, { destinationId: dest, area: null, query: '' }, search.stay, { ...search.filters, sort: 'rating' }).slice(0, 3);
  }, [catalog.data, search.place.destinationId, search.stay, search.filters]);
  const popularDest = index.destinations.get(search.place.destinationId ?? 'bali');

  const openHotel = (id: string) => router.push(`/hotel/${id}`);
  const name = profile.data?.fullName ?? '';

  return (
    <Screen withNav onRefresh={() => void catalog.refetch()} refreshing={catalog.isRefetching}>
      <View style={styles.header}>
        <BrandMark size={42} />
        <View style={{ flex: 1 }} />
        <IconButton icon="bell" label={reminders.length ? `Reminders, ${reminders.length} new` : 'Reminders'} badge={reminders.length > 0} onPress={() => setRemindersOpen(true)} />
        <IconButton icon="settings" label="Settings" onPress={() => router.push('/profile')} />
        <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/profile')}>
          <Avatar name={name || 'Velora'} />
        </Pressable>
      </View>

      <View style={{ gap: 4 }}>
        <Txt variant="body" color="text2">
          {name ? `Hello, ${firstName(name)}` : 'Hello'}
        </Txt>
        <Txt variant="display" accessibilityRole="header">
          {'Where would you like\nto stay next?'}
        </Txt>
      </View>

      {/* Search hero */}
      <View style={styles.hero}>
        <View style={styles.summary}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Trip: ${search.placeLabel}, ${staySummary(search.stay)}. Change dates and guests`} onPress={() => setDatesOpen(true)} style={styles.summaryTap}>
            <View style={styles.pin}>
              <Icon name="map-pin" size={20} color="onInk" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="caption" color="text3" numberOfLines={1}>
                {search.placeLabel || 'Anywhere'}
              </Txt>
              <Txt variant="bodyMedium" color="onInk" numberOfLines={1}>
                {staySummary(search.stay)}
              </Txt>
            </View>
          </Pressable>
          <IconButton icon="sparkles" label="Trip planner (coming soon)" look="lime" onPress={() => toast('The AI trip planner is coming soon.', { aboveNav: true })} />
        </View>
        <View style={styles.panel}>
          <View style={styles.searchRow}>
            <SearchField value="" placeholder="Search luxury stays" onPress={() => router.push('/search')} />
            <IconButton icon="sliders" label="Filters" look="ink" iconColor="lime" onPress={() => setFiltersOpen(true)} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
            <CategoryChip label="Hotels" icon="hotel" selected onPress={() => router.push('/search')} />
            <CategoryChip label="Flights" icon="plane" selected={false} onPress={() => router.push('/flights')} />
            <CategoryChip label="Car" icon="car" selected={false} onPress={() => router.push('/car')} />
          </ScrollView>
        </View>
      </View>

      {catalog.isError ? (
        <ErrorState message={errorMessage(catalog.error)} onRetry={() => void catalog.refetch()} offline={(catalog.error as { code?: string })?.code === 'network'} />
      ) : (
        <>
          <SectionHeader title="Featured destinations" onViewAll={() => router.push('/search')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.rail}>
            {catalog.data
              ? catalog.data.destinations.map((d) => (
                  <DestinationCard key={d.id} destination={d} stays={catalog.data.hotels.filter((h) => h.destinationId === d.id).length} onPress={() => router.push(`/destination/${d.id}`)} />
                ))
              : [0, 1, 2].map((k) => <Skeleton key={k} width={124} height={164} radius={24} />)}
          </ScrollView>

          <SectionHeader
            title="Recommended for you"
            onViewAll={() => {
              search.setPlace({ destinationId: null, area: null, query: '' }, 'All destinations');
              router.push('/results');
            }}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.rail}>
            {catalog.data
              ? recommended.map((h) => (
                  <HotelCard
                    key={h.id}
                    width={290}
                    hotel={h}
                    place={index.place(h)}
                    priceCents={fromPriceFor(h, search.stay) ?? h.fromPriceCents}
                    tags={[h.highlights[0], guestsLabel(search.stay)].filter(Boolean)}
                    saved={fav.isSaved(h.id)}
                    onToggleSave={() => fav.toggle(h.id)}
                    onPress={() => openHotel(h.id)}
                  />
                ))
              : [0, 1].map((k) => <Skeleton key={k} width={290} height={338} radius={30} />)}
          </ScrollView>

          {popular.length ? (
            <>
              <SectionHeader title={`Popular in ${popularDest?.name ?? 'Bali'}`} />
              <View style={{ gap: 12, marginTop: -8 }}>
                {popular.map((h) => (
                  <StayRow key={h.id} hotel={h} place={index.place(h)} priceCents={fromPriceFor(h, search.stay) ?? h.fromPriceCents} onPress={() => openHotel(h.id)} />
                ))}
              </View>
            </>
          ) : null}

          {catalog.data?.isSampleData ? <DevNote text="Sample hotels, prices and ratings for development — not live availability." /> : null}
        </>
      )}

      <DatesGuestsSheet
        visible={datesOpen}
        stay={search.stay}
        onClose={() => setDatesOpen(false)}
        onApply={(s) => {
          search.setStay(s);
          setDatesOpen(false);
          toast(`Dates updated · ${plural(nightsBetween(s.checkIn, s.checkOut), 'night')}`, { aboveNav: true });
        }}
      />
      {catalog.data ? (
        <FiltersSheet
          visible={filtersOpen}
          catalog={catalog.data}
          place={search.place}
          stay={search.stay}
          filters={search.filters}
          onClose={() => setFiltersOpen(false)}
          onApply={(f) => {
            search.setFilters(f);
            setFiltersOpen(false);
            router.push('/results');
          }}
        />
      ) : null}
      <RemindersSheet visible={remindersOpen} onClose={() => setRemindersOpen(false)} reminders={reminders} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hero: { backgroundColor: colors.ink, borderRadius: 32, padding: 8, gap: 8 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingLeft: 10, paddingRight: 8, paddingBottom: 6 },
  summaryTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pin: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink2, alignItems: 'center', justifyContent: 'center' },
  panel: { backgroundColor: colors.surface, borderRadius: 26, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 14, gap: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cats: { flexDirection: 'row', gap: 8 },
  bleed: { marginHorizontal: -SIDE, marginTop: -8 },
  rail: { paddingHorizontal: SIDE, gap: 12 },
});
