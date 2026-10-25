import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/Brand';
import { Button, IconButton } from '@/components/Button';
import { Photo } from '@/components/Photo';
import { Txt } from '@/components/Text';
import { useSession } from '@/state/session';
import { colors, SIDE } from '@/theme/tokens';

const SLIDES = [
  { photo: 'dest-maldives', title: 'Stay somewhere\nunforgettable', body: 'Handpicked villas, resorts and boutique hotels in destinations you’ll want to return to.' },
  { photo: 'room-ocean-view-pool-villa', title: 'Book in a few taps', body: 'Compare rooms, see the full price up front and pay securely — no surprises at checkout.' },
  { photo: 'onboarding-oia', title: 'Your trip, all in\none place', body: 'Vouchers, check-in times and directions for every stay you book.' },
];

/** Figma 11a–c onboarding. Shown on first launch; Skip or finishing marks it as seen. */
export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useSession();
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  const finish = () => {
    completeOnboarding();
    router.replace('/sign-in');
  };

  return (
    <View style={styles.root}>
      <Photo photo={slide.photo} style={styles.photo} label="Travel photo" />
      <LinearGradient colors={['rgba(20,20,20,0)', 'rgba(20,20,20,1)']} locations={[0.35, 0.72]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <Wordmark height={27} onDark />
        <Pressable accessibilityRole="button" onPress={finish} style={styles.skip} hitSlop={8}>
          <Txt variant="label" color="onInk">
            Skip
          </Txt>
        </Pressable>
      </View>
      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
        <View style={styles.dots} accessibilityLabel={`Step ${i + 1} of ${SLIDES.length}`}>
          {SLIDES.map((_, k) => (
            <View key={k} style={[styles.dot, k === i ? styles.dotOn : null]} />
          ))}
        </View>
        <Txt variant="display" size={32} color="onInk" accessibilityRole="header">
          {slide.title}
        </Txt>
        <Txt variant="body" color="text3" style={{ marginBottom: 30 }}>
          {slide.body}
        </Txt>
        <View style={styles.cta}>
          <Button label={last ? 'Get started' : 'Next'} variant="lime" onPress={() => (last ? finish() : setI(i + 1))} style={{ flex: 1 }} />
          <IconButton icon="arrow-right" label={last ? 'Get started' : 'Next slide'} onPress={() => (last ? finish() : setI(i + 1))} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  photo: { position: 'absolute', top: 0, left: 0, right: 0, height: '71%' },
  top: { position: 'absolute', left: SIDE, right: SIDE, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skip: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  body: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, gap: 14 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotOn: { width: 24, backgroundColor: colors.lime },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: -4 },
});
