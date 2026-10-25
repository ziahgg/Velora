import { useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { colors } from '@/theme/tokens';

const THUMB = 28;

/**
 * Two-thumb slider with the price histogram from the Filters frame: ink bars
 * inside the selected range, grey outside, lime thumbs. The track handles the
 * touch: the nearer thumb follows the finger and snaps to `step`.
 */
export function RangeSlider({
  min,
  max,
  step,
  low,
  high,
  histogram,
  onChange,
  formatLabel,
}: {
  min: number;
  max: number;
  step: number;
  low: number;
  high: number;
  histogram: number[];
  onChange: (low: number, high: number) => void;
  formatLabel: (v: number) => string;
}) {
  const [width, setWidth] = useState(0);
  const dragging = useRef<'low' | 'high' | null>(null);

  const span = Math.max(1, max - min);
  const track = Math.max(1, width - THUMB);
  const toX = (v: number) => ((v - min) / span) * track;
  const toValue = (x: number) => Math.min(max, Math.max(min, Math.round((((x - THUMB / 2) / track) * span) / step) * step + min));

  const move = (e: GestureResponderEvent) => {
    const v = toValue(e.nativeEvent.locationX);
    if (dragging.current === 'low') onChange(Math.min(v, high - step), high);
    else if (dragging.current === 'high') onChange(low, Math.max(v, low + step));
  };

  const maxCount = Math.max(1, ...histogram);
  const bucketSpan = span / histogram.length;

  return (
    <View style={{ height: 76, justifyContent: 'flex-end' }}>
      <View style={styles.bars} pointerEvents="none">
        {histogram.map((count, i) => {
          const bucketLow = min + i * bucketSpan;
          const inRange = bucketLow + bucketSpan > low && bucketLow < high;
          return <View key={i} style={[styles.bar, { height: count ? 10 + (count / maxCount) * 34 : 8, backgroundColor: inRange && count ? colors.ink : colors.chip }]} />;
        })}
      </View>
      <View
        style={styles.trackWrap}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          const x = e.nativeEvent.locationX;
          dragging.current = Math.abs(x - (toX(low) + THUMB / 2)) <= Math.abs(x - (toX(high) + THUMB / 2)) ? 'low' : 'high';
          move(e);
        }}
        onResponderMove={move}
        onResponderRelease={() => {
          dragging.current = null;
        }}
      >
        <View style={styles.track} pointerEvents="none" />
        {width > 0 ? (
          <>
            <View pointerEvents="none" style={[styles.active, { left: toX(low) + THUMB / 2, width: Math.max(0, toX(high) - toX(low)) }]} />
            <View
              pointerEvents="none"
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={`Minimum price ${formatLabel(low)}`}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e) => onChange(e.nativeEvent.actionName === 'increment' ? Math.min(low + step, high - step) : Math.max(min, low - step), high)}
              style={[styles.thumb, { left: toX(low) }]}
            />
            <View
              pointerEvents="none"
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={`Maximum price ${formatLabel(high)}`}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e) => onChange(low, e.nativeEvent.actionName === 'increment' ? Math.min(max, high + step) : Math.max(low + step, high - step))}
              style={[styles.thumb, { left: toX(high) }]}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 44, paddingHorizontal: THUMB / 2 - 4, marginBottom: 2 },
  bar: { flex: 1, borderRadius: 6 },
  trackWrap: { height: THUMB + 12, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.chip, marginHorizontal: THUMB / 2 },
  active: { position: 'absolute', height: 4, backgroundColor: colors.ink, borderRadius: 2 },
  thumb: { position: 'absolute', top: 6, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.lime, borderWidth: 3, borderColor: colors.ink },
});
