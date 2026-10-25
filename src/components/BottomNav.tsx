import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadows } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'house' },
  search: { label: 'Search', icon: 'search' },
  saved: { label: 'Saved stays', icon: 'heart' },
  trips: { label: 'My Trips', icon: 'calendar' },
  profile: { label: 'Profile', icon: 'user' },
};

/**
 * Figma "Bottom Navigation": a floating 330×60 white pill with five 54 px
 * circles — ink when active, grey otherwise. The heart is drawn filled when
 * inactive and outlined when active, as in the frames.
 */
export function BottomNav({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Search results live inside the tabs (so the nav stays visible) and light up the Search circle.
  const current = state.routes[state.index]?.name;
  const active = current === 'results' ? 'search' : current;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 8) + 8 }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = route.name === active;
          const filledHeart = tab.icon === 'heart' && !focused;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => navigateToTab(route.key)}
              style={({ pressed }) => [styles.tab, { backgroundColor: focused ? colors.ink : colors.chip }, pressed ? { opacity: 0.8 } : null]}
            >
              <Icon name={tab.icon} size={21} color={focused ? 'onInk' : 'ink'} fill={filledHeart ? 'ink' : undefined} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: { width: 330, maxWidth: '92%', height: 60, borderRadius: 999, backgroundColor: colors.surface, padding: 3, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...shadows.nav },
  tab: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
});
