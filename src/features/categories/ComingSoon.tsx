import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { AppBar, Screen } from '@/components/Layout';
import { CategoryChip } from '@/components/Pills';
import { Txt } from '@/components/Text';
import { colors } from '@/theme/tokens';

/**
 * Flights and Car are in the design (Figma 17–20) but have no inventory,
 * pricing or reservation flow yet, so they are clearly marked as coming soon
 * instead of showing search forms that can't return real results.
 */
export function ComingSoon({ category }: { category: 'flights' | 'car' }) {
  const router = useRouter();
  const flights = category === 'flights';
  return (
    <Screen gap={20}>
      <AppBar title={flights ? 'Flights' : 'Car rental'} />
      <View style={styles.cats}>
        <CategoryChip label="Hotels" icon="hotel" selected={false} onPress={() => router.replace('/search')} />
        <CategoryChip label="Flights" icon="plane" selected={flights} onPress={() => !flights && router.replace('/flights')} />
        <CategoryChip label="Car" icon="car" selected={!flights} onPress={() => flights && router.replace('/car')} />
      </View>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Txt variant="captionMedium" color="ink">
            Coming soon
          </Txt>
        </View>
        <View style={styles.icon}>
          <Icon name={flights ? 'plane' : 'car'} size={34} color="ink" />
        </View>
        <Txt variant="display" color="onInk">
          {flights ? 'Flights are on the way' : 'Car rental is on the way'}
        </Txt>
        <Txt variant="body" color="text3">
          {flights
            ? 'Velora books hotels today. Flight search isn’t available yet — there are no flight fares, seats or tickets in this version of the app.'
            : 'Velora books hotels today. Car rental isn’t available yet — there are no cars, rates or reservations in this version of the app.'}
        </Txt>
      </View>
      <Button label="Search hotels instead" onPress={() => router.replace('/search')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cats: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hero: { backgroundColor: colors.ink, borderRadius: 32, padding: 24, gap: 14 },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.lime, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  icon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
