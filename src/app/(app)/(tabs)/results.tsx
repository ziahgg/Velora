import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/Button';
import { HotelCard } from '@/components/Cards';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/Feedback';
import { Screen } from '@/components/Layout';
import { Segmented, Tag } from '@/components/Pills';
import { Txt } from '@/components/Text';
import { useFavoriteToggle } from '@/features/favorites/useFavoriteToggle';
import { DatesGuestsSheet } from '@/features/search/DatesGuestsSheet';
import { FiltersSheet } from '@/features/search/FiltersSheet';
import { SchematicMap } from '@/features/search/SchematicMap';
import { formatRange } from '@/lib/dates';
import { guestsLabel } from '@/lib/format';
import { formatUSDShort } from '@/lib/money';
import { EMPTY_FILTERS, fromPriceFor, searchHotels, SORT_LABEL, type Filters } from '@/lib/search';
import { useCatalog, useCatalogIndex } from '@/state/queries';
import { useSearch } from '@/state/search';
import { errorMessage } from '@/state/session';
import { colors, SIDE } from '@/theme/tokens';

const TYPE_LABEL = { villa: 'Villas', resort: 'Resorts', hotel: 'Hotels', apartment: 'Apartments' } as const;

/** Figma 09 Search Results and 09b map view. */
export default function Results() {
  const router = useRouter();
  const catalog = useCatalog();
  const index = useCatalogIndex(catalog.data);
  const search = useSearch();
  const fav = useFavoriteToggle({ aboveNav: true });
  const [view, setView] = useState<'list' | 'map'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const { rememberSearch } = search;

  // Each completed search goes to "Recent searches".
  useEffect(() => {
    rememberSearch();
  }, [rememberSearch]);

  const results = useMemo(() => (catalog.data ? searchHotels(catalog.data, search.place, search.stay, search.filters) : []), [catalog.data, search.place, search.stay, search.filters]);
  const prices = useMemo(() => new Map(results.map((h) => [h.id, fromPriceFor(h, search.stay) ?? h.fromPriceCents])), [results, search.stay]);

  const f = search.filters;
  const setF = (patch: Partial<Filters>) => search.setFilters({ ...f, ...patch });
  const active: { key: string; label: string; clear: () => void }[] = [
    ...(f.propertyTypes.length ? [{ key: 'types', label: f.propertyTypes.map((t) => TYPE_LABEL[t]).join(' · '), clear: () => setF({ propertyTypes: [] }) }] : []),
    ...(f.minRating !== null ? [{ key: 'rating', label: `${f.minRating.toFixed(1)}+`, clear: () => setF({ minRating: null }) }] : []),
    ...f.amenityIds.map((a) => ({ key: a, label: index.amenities.get(a)?.label ?? a, clear: () => setF({ amenityIds: f.amenityIds.filter((x) => x !== a) }) })),
    ...(f.minPriceCents !== null || f.maxPriceCents !== null
      ? [{ key: 'price', label: `${f.minPriceCents !== null ? formatUSDShort(f.minPriceCents) : '$0'}–${f.maxPriceCents !== null ? formatUSDShort(f.maxPriceCents) : 'any'}`, clear: () => setF({ minPriceCents: null, maxPriceCents: null }) }]
      : []),
    ...(f.sort !== 'recommended' ? [{ key: 'sort', label: SORT_LABEL[f.sort], clear: () => setF({ sort: 'recommended' }) }] : []),
  ];

  const tags = (h: (typeof results)[number]) => [h.highlights[0], guestsLabel(search.stay)].filter(Boolean);

  return (
    <Screen withNav gap={16}>
      <View style={styles.top}>
        <IconButton icon="arrow-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/search'))} />
        <Pressable accessibilityRole="button" accessibilityLabel={`${search.placeLabel}, ${formatRange(search.stay.checkIn, search.stay.checkOut)}, ${guestsLabel(search.stay)}. Change dates and guests`} onPress={() => setDatesOpen(true)} style={styles.query}>
          <Txt variant="label" numberOfLines={1}>
            {search.placeLabel || 'All destinations'}
          </Txt>
          <Txt variant="caption" color="text2" numberOfLines={1}>
            {formatRange(search.stay.checkIn, search.stay.checkOut)} · {guestsLabel(search.stay)}
          </Txt>
        </Pressable>
        <IconButton icon="sliders" label="Filters and sort" look="ink" iconColor="lime" onPress={() => setFiltersOpen(true)} />
      </View>

      {active.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -SIDE }} contentContainerStyle={{ paddingHorizontal: SIDE, gap: 8 }}>
          {active.map((a) => (
            <Tag key={a.key} label={`${a.label}  ✕`} look="selected" onPress={a.clear} />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.count}>
        <Txt variant="label" accessibilityLiveRegion="polite">
          {catalog.data ? (results.length === 1 ? '1 stay found' : `${results.length} stays found`) : 'Searching…'}
        </Txt>
        <Segmented
          compact
          value={view}
          onChange={setView}
          options={[
            { id: 'list', label: 'List' },
            { id: 'map', label: 'Map' },
          ]}
        />
      </View>

      {catalog.isPending ? (
        <View style={{ gap: 16 }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : catalog.isError ? (
        <ErrorState message={errorMessage(catalog.error)} onRetry={() => void catalog.refetch()} />
      ) : results.length === 0 ? (
        <EmptyState
          icon="search-x"
          title="No stays match"
          body="Try fewer filters, other dates or a different destination."
          action={active.length ? { label: 'Clear filters', onPress: () => search.setFilters({ ...EMPTY_FILTERS }) } : { label: 'Change search', onPress: () => router.navigate('/search') }}
        />
      ) : view === 'map' ? (
        <SchematicMap hotels={results} prices={prices} place={index.place} onOpen={(id) => router.push(`/hotel/${id}`)} />
      ) : (
        <View style={{ gap: 16 }}>
          {results.map((h) => (
            <HotelCard
              key={h.id}
              hotel={h}
              place={index.place(h)}
              priceCents={prices.get(h.id) ?? h.fromPriceCents}
              tags={tags(h)}
              saved={fav.isSaved(h.id)}
              onToggleSave={() => fav.toggle(h.id)}
              onPress={() => router.push(`/hotel/${h.id}`)}
            />
          ))}
        </View>
      )}

      {catalog.data ? (
        <FiltersSheet
          visible={filtersOpen}
          catalog={catalog.data}
          place={search.place}
          stay={search.stay}
          filters={search.filters}
          onClose={() => setFiltersOpen(false)}
          onApply={(nf) => {
            search.setFilters(nf);
            setFiltersOpen(false);
          }}
        />
      ) : null}
      <DatesGuestsSheet
        visible={datesOpen}
        stay={search.stay}
        onClose={() => setDatesOpen(false)}
        onApply={(s) => {
          search.setStay(s);
          setDatesOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  query: { flex: 1, height: 48, borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 18, justifyContent: 'center' },
  count: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
