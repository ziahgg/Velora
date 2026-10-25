import { View } from 'react-native';

import { PaymentMethodRow } from '@/components/Cards';
import { DevNote } from '@/components/Feedback';
import { AppBar, Card, Screen } from '@/components/Layout';
import { Txt } from '@/components/Text';
import { MethodLogo } from '@/features/booking/MethodLogo';
import { payments } from '@/payments/adapter';

/** Payment methods — the sandbox adapter's test methods; no cards are stored. */
export default function PaymentMethods() {
  return (
    <Screen gap={16}>
      <AppBar title="Payment methods" />
      <Txt variant="body" color="text2">
        Velora never stores card numbers or security codes. In this build payments run through a sandbox, so these test methods are available at checkout.
      </Txt>
      <Card radius={24}>
        <View style={{ gap: 4 }}>
          {payments.listMethods().map((m) => (
            <PaymentMethodRow key={m.id} logo={<MethodLogo method={m} />} label={m.label} detail={m.detail} note={m.sandboxOutcome === 'declines' ? 'Always declines — for testing' : undefined} selected={false} onPress={() => undefined} />
          ))}
        </View>
      </Card>
      <DevNote icon="credit-card" text="Saving real cards needs a payment provider (e.g. Stripe) with server-side confirmation. See the README." />
    </Screen>
  );
}
