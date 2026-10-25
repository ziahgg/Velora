import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { StateHero } from '@/components/Feedback';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Layout';
import { Txt } from '@/components/Text';
import { useHoldCountdown } from '@/features/booking/useHoldCountdown';
import { formatCountdown } from '@/lib/booking';
import { payments } from '@/payments/adapter';
import { useBooking } from '@/state/queries';
import { colors } from '@/theme/tokens';

/** Figma S5 Payment Failed. The booking stays pending (held) — nothing was charged. */
export default function Declined() {
  const { bookingId, method } = useLocalSearchParams<{ bookingId: string; method?: string }>();
  const router = useRouter();
  const booking = useBooking(bookingId);
  const secondsLeft = useHoldCountdown(booking.data?.holdExpiresAt);
  const m = payments.listMethods().find((x) => x.id === method);
  const last4 = m?.detail.match(/(\d{4})$/)?.[1];

  const back = (methodId?: string) => router.replace({ pathname: '/booking/payment', params: { bookingId: bookingId!, ...(methodId ? { method: methodId } : {}) } });

  return (
    <Screen
      contentStyle={{ paddingTop: 110 }}
      gap={16}
      footer={
        <>
          <Button label="Try another method" onPress={() => back(payments.listMethods().find((x) => x.id !== method)?.id)} disabled={secondsLeft === 0} />
          <Button label={`Retry ${m?.label ?? 'payment'}`} variant="tonal" onPress={() => back(method)} disabled={secondsLeft === 0} />
        </>
      }
    >
      <StateHero icon="x" tone="error" />
      <Txt variant="display" align="center" accessibilityRole="header">
        Payment declined
      </Txt>
      <Txt variant="body" color="text2" align="center">
        {`The payment with ${m?.label ?? 'this method'}${last4 ? ` •••• ${last4}` : ''} was declined. You haven’t been charged. Try another method or contact your bank.`}
      </Txt>
      <View style={styles.hold} accessibilityLiveRegion="polite">
        <Icon name="clock" size={20} />
        <Txt variant="label" style={{ flex: 1 }}>
          {secondsLeft > 0 ? `We’re holding your room for ${formatCountdown(secondsLeft)} more minutes.` : 'Your hold has ended. Search again to book this stay.'}
        </Txt>
      </View>
      {payments.isSandbox ? (
        <Txt variant="caption" color="text3" align="center">
          Sandbox: this decline was simulated by the test card.
        </Txt>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hold: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 24, padding: 18 },
});
