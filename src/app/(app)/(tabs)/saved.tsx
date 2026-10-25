import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { IconButton } from '@/components/Button';
import { SavedCard } from '@/components/Cards';
import { EmptyState, ErrorState, Sheet, SkeletonCard } from '@/components/Feedback';
import { PageTitle, Screen } from '@/components/Layout';
import { ChipGroup, TagRow } from '@/components/Pills';
import type { Hotel } from '@/data/types';
import { useFavoriteToggle } from '@/features/favorites/useFavoriteToggle';
import { fromPriceFor } from '@/lib/search';
import { useCatalog, useCatalogIndex, useFavorites } from '@/state/queries';
import { useSearch } from '@/state/search';
import { errorMessage } from '@/state/session';

type SavedSort = 'recent' | 'price' | 'rating';

/** Figma 15 Favorites ("Saved stays") and S1 empty state. */
export default function Saved() {
  const router = useRouter();
  const favorites = useFavorites();
  const catalog = useCatalog();
  const index = useCatalogIndex(catalog.data);
  const { stay } = useSearch();
  const fav = useFavoriteToggle({ aboveNav: true });
  const [dest, setDest] = useState('all');
  const [sort, setSort] = useState<SavedSort>('recent');
  const [sortOpen, setSortOpen] = useState(false);

  const saved = useMemo(() => (favorites.data ?? []).map((f) => index.hotels.get(f.hotelId)).filter((h): h is Hotel => !!h), [favorites.data, index.hotels]);
  const price = (h: Hotel) => fromPriceFor(h, stay) ?? h.fromPriceCents;
  const shown = useMemo(() => {
    const list = saved.filter((h) => dest === 'all' || h.destinationId === dest);
    const p = (h: Hotel) => fromPriceFor(h, stay) ?? h.fromPriceCents;
    if (sort === 'price') return [...list].sort((a, b) => p(a) - p(b));
    if (sort === 'rating') return [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [saved, dest, sort, stay]);

  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of saved) counts.set(h.destinationId, (counts.get(h.destinationId) ?? 0) + 1);
    return [{ id: 'all', label: `All · ${saved.length}` }, ...[...counts].map(([id, n]) => ({ id, label: `${index.destinations.get(id)?.name ?? id} · ${n}` }))];
  }, [saved, index.destinations]);

  const rows: Hotel[][] = [];
  for (let i = 0; i < shown.length; i += 2) rows.push(shown.slice(i, i + 2));

  return (
    <Screen withNav gap={16} onRefresh={() => void favorites.refetch()} refreshing={favorites.isRefetching}>
      <PageTitle title="Saved stays" action={saved.length ? <IconButton icon="sliders" label="Sort saved stays" onPress={() => setSortOpen(true)} /> : undefined} />

      {favorites.isPending || catalog.isPending ? (
        <SkeletonCard />
      ) : favorites.isError ? (
        <ErrorState message={errorMessage(favorites.error)} onRetry={() => void favorites.refetch()} />
      ) : saved.length === 0 ? (
        <View style={{ paddingTop: 60 }}>
          <EmptyState icon="heart" title="No saved stays yet" body="Tap the heart on any stay to keep it here and compare later." action={{ label: 'Explore stays', onPress: () => router.navigate('/search') }} />
        </View>
      ) : (
        <>
          <TagRow options={chips} value={[dest]} onChange={(v) => setDest(v[0] ?? 'all')} />
          <View style={{ gap: 12 }}>
            {rows.map((row) => (
              <View key={row.map((h) => h.id).join()} style={{ flexDirection: 'row', gap: 12 }}>
                {row.map((h) => (
                  <SavedCard key={h.id} hotel={h} place={index.destinations.get(h.destinationId)?.name ?? h.area} priceCents={price(h)} onPress={() => router.push(`/hotel/${h.id}`)} onUnsave={() => fav.toggle(h.id)} />
                ))}
                {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))}
          </View>
        </>
      )}

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Sort saved stays">
        <ChipGroup
          options={[
            { id: 'recent', label: 'Recently saved' },
            { id: 'price', label: 'Price: low to high' },
            { id: 'rating', label: 'Top rated' },
          ]}
          value={[sort]}
          onChange={(v) => {
            setSort((v[0] as SavedSort) ?? 'recent');
            setSortOpen(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}
