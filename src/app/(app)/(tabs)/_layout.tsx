import { Tabs } from 'expo-router/js-tabs';

import { BottomNav } from '@/components/BottomNav';
import { colors } from '@/theme/tokens';

/** Home · Search · Saved · Trips · Profile — the five circles of the floating pill nav. */
export default function TabsLayout() {
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, animation: 'fade' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="saved" />
      <Tabs.Screen name="trips" />
      <Tabs.Screen name="profile" />
      {/* Routable, but BottomNav draws no circle for it — it highlights Search while open. */}
      <Tabs.Screen name="results" />
    </Tabs>
  );
}
