import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { StayRow } from '@/components/Cards';
import { DevNote } from '@/components/Feedback';
import { Txt } from '@/components/Text';
import type { Hotel } from '@/data/types';
import { formatUSDShort } from '@/lib/money';
import { colors, shadows } from '@/theme/tokens';

/**
 * Figma 09b map view, drawn schematically: hotels are placed by their
 * coordinates (projected into the view) on the design's stylised land/sea
 * background. No map tiles or map SDK are used — it is clearly labelled.
 */
export function SchematicMap({ hotels, prices, place, onOpen }: { hotels: Hotel[]; prices: Map<string, number>; place: (h: Hotel) => string; onOpen: (id: string) => void }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selected, setSelected] = useState<string | null>(hotels[0]?.id ?? null);
  const current = hotels.find((h) => h.id === selected) ?? hotels[0];

  const points = useMemo(() => {
    if (!hotels.length || !size.w) return [];
    const lats = hotels.map((h) => h.lat);
    const lngs = hotels.map((h) => h.lng);
    const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    const padX = 60;
    const top = 40;
    const bottom = 240; // keep pins above the stay card
    const sx = (size.w - padX * 2) / Math.max(1e-6, maxLng - minLng);
    const sy = (size.h - top - bottom) / Math.max(1e-6, maxLat - minLat);
    const placed: { id: string; x: number; y: number }[] = [];
    for (const h of hotels) {
      const p = {
        id: h.id,
        x: hotels.length === 1 ? size.w / 2 : padX + (h.lng - minLng) * sx,
        y: hotels.length === 1 ? (size.h - bottom) / 2 : top + (maxLat - h.lat) * sy,
      };
      // Nudge pins for neighbouring hotels apart so every price stays readable.
      while (placed.some((q) => Math.abs(q.x - p.x) < 72 && Math.abs(q.y - p.y) < 36)) p.y += 38;
      placed.push(p);
    }
    return placed;
  }, [hotels, size]);

  return (
    <View style={styles.map} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size.w ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Rect width={size.w} height={size.h} fill="#E5ECE3" />
          <Path d={`M0 ${size.h * 0.62} C ${size.w * 0.35} ${size.h * 0.5}, ${size.w * 0.7} ${size.h * 0.55}, ${size.w} ${size.h * 0.6} L ${size.w} ${size.h} L 0 ${size.h} Z`} fill="#C7DEEB" />
          {[0.15, 0.42, 0.7].map((k, i) => (
            <Path key={i} d={`M0 ${size.h * k} L ${size.w} ${size.h * (k + 0.12)}`} stroke="#FFFFFF" strokeWidth={10} opacity={0.75} />
          ))}
          <Path d={`M ${size.w * 0.1} 0 L ${size.w * 0.95} ${size.h * 0.8}`} stroke="#FFFFFF" strokeWidth={10} opacity={0.75} />
        </Svg>
      ) : null}
      {points.map((p) => {
        const on = p.id === current?.id;
        const hotel = hotels.find((h) => h.id === p.id)!;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`${hotel.name}, ${formatUSDShort(prices.get(p.id) ?? hotel.fromPriceCents)} per night`}
            onPress={() => setSelected(p.id)}
            style={[styles.pin, { left: p.x - 34, top: p.y - 16 }, on ? { backgroundColor: colors.ink, zIndex: 2 } : null]}
          >
            <Txt variant="rowTitle" size={14} color={on ? 'lime' : 'text'}>
              {formatUSDShort(prices.get(p.id) ?? hotel.fromPriceCents)}
            </Txt>
          </Pressable>
        );
      })}
      <View style={styles.bottom}>
        {current ? <StayRow hotel={current} place={place(current)} priceCents={prices.get(current.id) ?? current.fromPriceCents} onPress={() => onOpen(current.id)} /> : null}
        <DevNote text="Schematic map — pins are placed by sample coordinates, not a live map." />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { height: 560, borderRadius: 30, overflow: 'hidden', backgroundColor: '#E5ECE3' },
  pin: { position: 'absolute', minWidth: 68, height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.pin },
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 8 },
});
