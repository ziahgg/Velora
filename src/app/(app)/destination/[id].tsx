import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, ViewAll } from '@/components/Button';
import { StayRow } from '@/components/Cards';
import { DevNote, EmptyState, ErrorState, FullScreenLoader } from '@/components/Feedback';
import { Photo } from '@/components/Photo';
import { Tag, TagRow } from '@/components/Pills';
import { Txt } from '@/components/Text';
import { formatUSDShort } from '@/lib/money';
import { fromPriceFor, searchHotels } from '@/lib/search';
import { useCatalog, useCatalogIndex } from '@/state/queries';
import { useSearch } from '@/state/search';
import { errorMessage } from '@/state/session';
import { colors, SIDE } from '@/theme/tokens';

/** Figma 10 Destination. Tapping a destination applies it to hotel discovery. */
export default function DestinationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const index = useCatalogIndex(catalog.data);
  const search = useSearch();
  const [area, setArea] = useState('all');
  const dest = id ? index.destinations.get(id) : undefined;

  const stays = useMemo(
    () => (catalog.data && dest ? searchHotels(catalog.data, { destinationId: dest.id, area: area === 'all' ? null : area, query: '' }, search.stay, { ...search.filters, sort: 'rating' }) : []),
    [catalog.data, dest, area, search.stay, search.filters],
  );
  const allHere = useMemo(() => catalog.data?.hotels.filter((h) => h.destinationId === dest?.id) ?? [], [catalog.data, dest]);
  const from = useMemo(() => {
    const prices = allHere.map((h) => fromPriceFor(h, search.stay)).filter((p): p is number => p !== null);
    return prices.length ? Math.min(...prices) : null;
  }, [allHere, search.stay]);

  if (catalog.isPending) return <FullScreenLoader />;
  if (catalog.isError) return <View style={styles.fill}><ErrorState message={errorMessage(catalog.error)} onRetry={() => void catalog.refetch()} /></View>;
  if (!dest) return <View style={[styles.fill, { paddingTop: insets.top + 80 }]}><EmptyState icon="globe" title="Destination not found" body="Try another destination." action={{ label: 'Back', onPress: () => router.back() }} /></View>;

  const viewAll = () => {
    search.setPlace({ destinationId: dest.id, area: area === 'all' ? null : area, query: '' }, area === 'all' ? `${dest.name}, ${dest.country}` : `${area}, ${dest.name}`);
    router.push('/results');
  };

  return (
    <View style={styles.fill}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Photo photo={dest.photo} style={{ height: 400 }} label={`${dest.name} photo`}>
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
          <View style={[styles.bar, { top: insets.top + 8 }]}>
            <IconButton icon="arrow-left" label="Back" look="glass" onPress={() => router.back()} />
            <IconButton icon="share" label="Share" look="glass" onPress={() => void Share.share({ message: `${dest.name}, ${dest.country} — stays on Velora.` })} />
          </View>
          <View style={styles.heroText}>
            <Txt variant="body" color="onInk" size={15}>
              {dest.country === dest.name ? 'Indian Ocean' : dest.country}
            </Txt>
            <Txt variant="display" size={56} color="onInk" accessibilityRole="header">
              {dest.name}
            </Txt>
            <View style={styles.pills}>
              <Tag label={allHere.length === 1 ? '1 stay' : `${allHere.length} stays`} look="glass" size="md" />
              {from !== null ? <Tag label={`From ${formatUSDShort(from)}/night`} look="glass" size="md" /> : null}
            </View>
          </View>
        </Photo>

        <View style={styles.sheet}>
          <Txt variant="body" color="text2" size={15}>
            {dest.blurb}
          </Txt>
          <TagRow options={[{ id: 'all', label: 'All areas' }, ...dest.areas.map((a) => ({ id: a, label: a }))]} value={[area]} onChange={(v) => setArea(v[0] ?? 'all')} />
          <View style={styles.head}>
            <Txt variant="heading">Top stays in {dest.name}</Txt>
            <ViewAll onPress={viewAll} />
          </View>
          {stays.length ? (
            <View style={{ gap: 12 }}>
              {stays.map((h) => (
                <StayRow key={h.id} hotel={h} place={index.place(h)} subtitle={h.area} priceCents={fromPriceFor(h, search.stay) ?? h.fromPriceCents} onPress={() => router.push(`/hotel/${h.id}`)} />
              ))}
            </View>
          ) : (
            <EmptyState icon="search-x" title="No stays here for your party" body="Try another area, or change guests and rooms." />
          )}
          {catalog.data?.isSampleData ? <DevNote text="Sample destination data for development." /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  bar: { position: 'absolute', left: SIDE, right: SIDE, flexDirection: 'row', justifyContent: 'space-between' },
  heroText: { position: 'absolute', left: SIDE, right: SIDE, bottom: 56, gap: 2 },
  pills: { flexDirection: 'row', gap: 8, marginTop: 6 },
  sheet: { marginTop: -34, backgroundColor: colors.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: SIDE, paddingTop: 26, gap: 20 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
