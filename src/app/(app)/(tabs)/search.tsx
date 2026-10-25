import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/Button';
import { DevNote, ErrorState } from '@/components/Feedback';
import { SearchField } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Photo } from '@/components/Photo';
import { CategoryChip, Tag } from '@/components/Pills';
import { AppBar, Card, Screen, SectionHeader } from '@/components/Layout';
import { Txt } from '@/components/Text';
import { FiltersSheet } from '@/features/search/FiltersSheet';
import { formatRange } from '@/lib/dates';
import { guestsLabel } from '@/lib/format';
import { suggestPlaces, type Place } from '@/lib/search';
import { useCatalog, useCatalogIndex } from '@/state/queries';
import { useSearch } from '@/state/search';
import { errorMessage } from '@/state/session';
import { colors, SIDE } from '@/theme/tokens';

/** Figma 08 Search: query, categories, recent searches, trending tags and popular destinations. */
export default function SearchScreen() {
  const router = useRouter();
  const catalog = useCatalog();
  const index = useCatalogIndex(catalog.data);
  const search = useSearch();
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const suggestions = useMemo(() => (catalog.data ? suggestPlaces(catalog.data, query) : []), [catalog.data, query]);
  const dest = index.destinations.get(search.place.destinationId ?? 'bali') ?? catalog.data?.destinations[0];
  const trending = useMemo(() => {
    if (!catalog.data || !dest) return [];
    const counts = new Map<string, number>();
    for (const h of catalog.data.hotels.filter((x) => x.destinationId === dest.id)) for (const t of h.highlights) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
  }, [catalog.data, dest]);

  const go = (place: Place, label: string) => {
    search.setPlace(place, label);
    router.push('/results');
  };
  const submit = () => {
    const q = query.trim();
    if (!q) return;
    if (suggestions[0] && suggestions[0].label.toLowerCase().startsWith(q.toLowerCase())) go(suggestions[0].place, suggestions[0].label);
    else go({ destinationId: null, area: null, query: q }, `“${q}”`);
  };

  return (
    <Screen withNav gap={22}>
      <AppBar title="Search" onBack={() => router.navigate('/')} />
      <View style={styles.searchRow}>
        <SearchField look="outlined" value={query} onChangeText={setQuery} placeholder="Destination, area or stay" onSubmit={submit} />
        <IconButton icon="sliders" label="Filters" look="ink" iconColor="lime" size={52} onPress={() => setFiltersOpen(true)} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -SIDE }} contentContainerStyle={[styles.cats, { paddingHorizontal: SIDE }]}>
        <CategoryChip label="Hotels" icon="hotel" selected onPress={() => undefined} />
        <CategoryChip label="Flights" icon="plane" selected={false} onPress={() => router.push('/flights')} />
        <CategoryChip label="Car" icon="car" selected={false} onPress={() => router.push('/car')} />
      </ScrollView>

      {catalog.isError ? <ErrorState message={errorMessage(catalog.error)} onRetry={() => void catalog.refetch()} /> : null}

      {query.trim() ? (
        <Card padding={8} radius={30}>
          {suggestions.length ? (
            suggestions.map((s) => (
              <Pressable key={s.label} accessibilityRole="button" onPress={() => go(s.place, s.label)} style={styles.recent}>
                <View style={styles.recentIcon}>
                  <Icon name={s.sub === 'Destination' ? 'globe' : s.sub === 'Area' ? 'map-pin' : 'hotel'} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="rowTitle">{s.label}</Txt>
                  <Txt variant="caption" color="text2">
                    {s.sub}
                  </Txt>
                </View>
                <Icon name="chevron-right" size={18} color="text2" />
              </Pressable>
            ))
          ) : (
            <Pressable accessibilityRole="button" onPress={submit} style={styles.recent}>
              <View style={styles.recentIcon}>
                <Icon name="search" size={20} />
              </View>
              <Txt variant="rowTitle" style={{ flex: 1 }}>
                Search for “{query.trim()}”
              </Txt>
            </Pressable>
          )}
        </Card>
      ) : (
        <>
          {search.recent.length ? (
            <>
              <SectionHeader title="Recent searches" onViewAll={search.clearRecent} linkLabel="Clear" />
              <Card padding={8} radius={30} style={{ marginTop: -8 }}>
                {search.recent.map((r) => (
                  <Pressable
                    key={r.at}
                    accessibilityRole="button"
                    onPress={() => {
                      search.setStay(r.stay);
                      go(r.place, r.label);
                    }}
                    style={styles.recent}
                  >
                    <View style={styles.recentIcon}>
                      <Icon name="clock" size={20} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="rowTitle" numberOfLines={1}>
                        {r.label}
                      </Txt>
                      <Txt variant="body" color="text2">
                        {formatRange(r.stay.checkIn, r.stay.checkOut)} · {guestsLabel(r.stay)}
                      </Txt>
                    </View>
                    <Icon name="chevron-right" size={18} color="text2" />
                  </Pressable>
                ))}
              </Card>
            </>
          ) : null}

          {dest && trending.length ? (
            <>
              <SectionHeader title={`Trending in ${dest.name}`} />
              <View style={styles.wrap}>
                {trending.map((t) => (
                  <Tag key={t} label={t} size="md" onPress={() => go({ destinationId: dest.id, area: null, query: t }, `${t} · ${dest.name}`)} />
                ))}
              </View>
            </>
          ) : null}

          <SectionHeader title="Popular destinations" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -SIDE, marginTop: -8 }} contentContainerStyle={{ paddingHorizontal: SIDE, gap: 10 }}>
            {(catalog.data?.destinations ?? []).map((d) => (
              <Pressable key={d.id} accessibilityRole="button" onPress={() => go({ destinationId: d.id, area: null, query: '' }, `${d.name}, ${d.country}`)} style={styles.destPill}>
                <Photo photo={d.photo} radius={18} style={{ width: 36, height: 36 }} />
                <Txt variant="rowTitle">{d.name}</Txt>
              </Pressable>
            ))}
          </ScrollView>
          {catalog.data?.isSampleData ? <DevNote text="Search runs over the sample catalog bundled for development." /> : null}
        </>
      )}

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cats: { flexDirection: 'row', gap: 8 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 8 },
  recentIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -8 },
  destPill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 999, padding: 6, paddingRight: 16 },
});
