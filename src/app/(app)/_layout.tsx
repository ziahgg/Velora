import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export const unstable_settings = { anchor: '(tabs)' };

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      {/* Confirmation replaces the payment step; back goes to trips, not to a paid form. */}
      <Stack.Screen name="booking/confirmed" options={{ gestureEnabled: false, animation: 'fade' }} />
    </Stack>
  );
}
