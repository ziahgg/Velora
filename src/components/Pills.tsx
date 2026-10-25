import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, SIDE, type ColorToken } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

/** Figma "Tag": 32 px pill — Outline (on white), Filled (on cards), Selected (ink). */
export function Tag({ label, look = 'outline', icon, onPress, size = 'sm' }: { label: string; look?: 'outline' | 'filled' | 'selected' | 'lime' | 'glass'; icon?: IconName; onPress?: () => void; size?: 'sm' | 'md' }) {
  const s = {
    outline: { bg: colors.surface, fg: 'text' as ColorToken, border: colors.border },
    filled: { bg: colors.chip, fg: 'text' as ColorToken, border: 'transparent' },
    selected: { bg: colors.ink, fg: 'onInk' as ColorToken, border: colors.ink },
    lime: { bg: colors.lime, fg: 'ink' as ColorToken, border: colors.lime },
    glass: { bg: 'rgba(255,255,255,0.22)', fg: 'onInk' as ColorToken, border: 'transparent' },
  }[look];
  const body = (
    <View style={[styles.tag, size === 'md' ? styles.tagMd : null, { backgroundColor: s.bg, borderColor: s.border }]}>
      {icon ? <Icon name={icon} size={14} color={s.fg} /> : null}
      <Txt variant="captionMedium" color={s.fg} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: look === 'selected' }} accessibilityLabel={label} onPress={onPress} hitSlop={6}>
      {body}
    </Pressable>
  );
}

/** Horizontally scrolling row of selectable tags (filters, room types, areas). */
export function TagRow({
  options,
  value,
  onChange,
  multi,
  style,
  look = 'outline',
}: {
  options: { id: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
  style?: StyleProp<ViewStyle>;
  look?: 'outline' | 'filled';
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ marginHorizontal: -SIDE }, style]} contentContainerStyle={{ paddingHorizontal: SIDE, gap: 8 }}>
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <Tag
            key={o.id}
            label={o.label}
            size="md"
            look={on ? 'selected' : look}
            onPress={() => onChange(multi ? (on ? value.filter((v) => v !== o.id) : [...value, o.id]) : [o.id])}
          />
        );
      })}
    </ScrollView>
  );
}

/** Wrapping chip group for the filter sheet. */
export function ChipGroup({ options, value, onChange, multi }: { options: { id: string; label: string }[]; value: string[]; onChange: (next: string[]) => void; multi?: boolean }) {
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <Tag
            key={o.id}
            label={o.label}
            size="md"
            look={on ? 'selected' : 'outline'}
            onPress={() => onChange(multi ? (on ? value.filter((v) => v !== o.id) : [...value, o.id]) : on ? [] : [o.id])}
          />
        );
      })}
    </View>
  );
}

/** Figma "Category Chip": 44 px pill with an icon bubble; Hotels selected by default. */
export function CategoryChip({ label, icon, selected, onPress }: { label: string; icon: IconName; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.category, selected ? { backgroundColor: colors.ink, borderColor: colors.ink } : { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.bubble, { backgroundColor: selected ? colors.lime : colors.chip }]}>
        <Icon name={icon} size={16} color="ink" />
      </View>
      <Txt variant="label" color={selected ? 'onInk' : 'text'}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Figma "Rating": star + value pill (white on photos, grey on cards). */
export function Rating({ value, look = 'white', count }: { value: number; look?: 'white' | 'grey' | 'none'; count?: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`Rated ${value.toFixed(1)} out of 5${count ? `, ${count} reviews` : ''}`}
      style={[styles.rating, look === 'none' ? { paddingHorizontal: 0 } : { backgroundColor: look === 'white' ? colors.surface : colors.chip }]}
    >
      <Icon name="star" size={13} color="star" fill="star" />
      <Txt variant="caption" weight="bold">
        {value.toFixed(1)}
      </Txt>
    </View>
  );
}

/** Segmented control — My Trips tabs, List/Map toggle, Flights trip type. */
export function Segmented<T extends string>({ options, value, onChange, compact }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; compact?: boolean }) {
  return (
    <View style={[styles.segment, compact ? { padding: 3, gap: 2 } : null]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            style={[styles.segmentItem, compact ? { height: 28, paddingHorizontal: 14 } : { flex: 1 }, on ? { backgroundColor: colors.ink } : null]}
          >
            <Txt variant={compact ? 'captionMedium' : 'label'} color={on ? 'onInk' : 'text2'}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { height: 32, borderRadius: 999, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, alignSelf: 'flex-start' },
  tagMd: { height: 32, paddingHorizontal: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { height: 44, borderRadius: 999, borderWidth: 1, paddingLeft: 7, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bubble: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  rating: { height: 26, borderRadius: 999, paddingLeft: 8, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 999, padding: 4 },
  segmentItem: { height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
});
