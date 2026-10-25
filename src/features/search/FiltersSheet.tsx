import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet } from '@/components/Feedback';
import { ChipGroup } from '@/components/Pills';
import { Txt } from '@/components/Text';
import type { Catalog, PropertyType } from '@/data/types';
import { formatUSDShort } from '@/lib/money';
import type { StayInput } from '@/lib/pricing';
import { RangeSlider } from './RangeSlider';
import { EMPTY_FILTERS, fromPriceFor, priceHistogram, searchHotels, SORT_LABEL, type Filters, type Place, type SortKey } from '@/lib/search';

const PRICE_STEP = 2500; // $25
const RATINGS = [
  { id: 'any', label: 'Any' },
  { id: '4', label: '4.0+' },
  { id: '4.5', label: '4.5+' },
  { id: '4.8', label: '4.8+' },
];
const TYPES: { id: PropertyType; label: string }[] = [
  { id: 'villa', label: 'Villas' },
  { id: 'resort', label: 'Resorts' },
  { id: 'hotel', label: 'Hotels' },
  { id: 'apartment', label: 'Apartments' },
];
const FILTER_AMENITIES = ['private-pool', 'breakfast', 'spa', 'wifi', 'airport-transfer', 'beachfront', 'family'];

/** Figma 08b "Filters": price range with histogram, rating, property type, amenities — plus sort. */
export function FiltersSheet({
  visible,
  catalog,
  place,
  stay,
  filters,
  onClose,
  onApply,
}: {
  visible: boolean;
  catalog: Catalog;
  place: Place;
  stay: StayInput;
  filters: Filters;
  onClose: () => void;
  onApply: (f: Filters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  const [openedWith, setOpenedWith] = useState<Filters | null>(null);
  // Reset the draft each time the sheet opens (adjusting state during render, not in an effect).
  if (visible && openedWith !== filters) {
    setOpenedWith(filters);
    setDraft(filters);
  }

  const bounds = useMemo(() => {
    const prices = catalog.hotels.map((h) => fromPriceFor(h, stay)).filter((p): p is number => p !== null);
    const lo = Math.floor(Math.min(...prices, 10000) / PRICE_STEP) * PRICE_STEP;
    const hi = Math.ceil(Math.max(...prices, 20000) / PRICE_STEP) * PRICE_STEP;
    return { lo, hi };
  }, [catalog, stay]);
  const histogram = useMemo(() => priceHistogram(searchHotels(catalog, place, stay, { ...EMPTY_FILTERS }), stay, bounds.lo, bounds.hi, 12), [catalog, place, stay, bounds]);
  const count = useMemo(() => searchHotels(catalog, place, stay, draft).length, [catalog, place, stay, draft]);

  const low = draft.minPriceCents ?? bounds.lo;
  const high = draft.maxPriceCents ?? bounds.hi;
  const amenityOptions = catalog.amenities.filter((a) => FILTER_AMENITIES.includes(a.id)).map((a) => ({ id: a.id, label: a.label }));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      right={
        <Pressable accessibilityRole="button" onPress={() => setDraft({ ...EMPTY_FILTERS, sort: draft.sort })} hitSlop={10}>
          <Txt variant="bodyMedium" color="text2">
            Reset
          </Txt>
        </Pressable>
      }
      footer={<Button label={count === 1 ? 'Show 1 stay' : `Show ${count} stays`} onPress={() => onApply(draft)} />}
    >
      <View style={{ gap: 6 }}>
        <Txt variant="label">Price per night</Txt>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt variant="label" size={15}>
            {formatUSDShort(low)}
          </Txt>
          <Txt variant="label" size={15}>
            {formatUSDShort(high)}
            {high >= bounds.hi ? '+' : ''}
          </Txt>
        </View>
        <RangeSlider
          step={PRICE_STEP}
          formatLabel={formatUSDShort}
          min={bounds.lo}
          max={bounds.hi}
          low={low}
          high={high}
          histogram={histogram}
          onChange={(l, h) => setDraft({ ...draft, minPriceCents: l <= bounds.lo ? null : l, maxPriceCents: h >= bounds.hi ? null : h })}
        />
      </View>

      <Group title="Guest rating">
        <ChipGroup
          options={RATINGS}
          value={[draft.minRating === null ? 'any' : String(draft.minRating)]}
          onChange={(v) => setDraft({ ...draft, minRating: !v[0] || v[0] === 'any' ? null : Number(v[0]) })}
        />
      </Group>

      <Group title="Property type">
        <ChipGroup multi options={TYPES} value={draft.propertyTypes} onChange={(v) => setDraft({ ...draft, propertyTypes: v as PropertyType[] })} />
      </Group>

      <Group title="Amenities">
        <ChipGroup multi options={amenityOptions} value={draft.amenityIds} onChange={(v) => setDraft({ ...draft, amenityIds: v })} />
      </Group>

      <Group title="Sort by">
        <ChipGroup
          options={(Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({ id: k, label: SORT_LABEL[k] }))}
          value={[draft.sort]}
          onChange={(v) => setDraft({ ...draft, sort: (v[0] as SortKey) ?? 'recommended' })}
        />
      </Group>
    </Sheet>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <Txt variant="label">{title}</Txt>
      {children}
    </View>
  );
}
