import { View } from 'react-native';

import { AppBar, Card, Screen } from '@/components/Layout';
import { Txt } from '@/components/Text';

const FAQ = [
  { q: 'How is my total calculated?', a: 'Nightly rate × nights × rooms, plus the hotel’s tax rate and any nightly resort fee. Velora’s server re-prices every booking before you pay, so the total you see is the total you’re charged.' },
  { q: 'How long is a room held?', a: 'When you continue to payment, the room is held for 15 minutes. If the hold ends, no payment is taken and you can book again.' },
  { q: 'Can I cancel?', a: 'Each room shows its rule. Before the free-cancellation date you can cancel in My Trips. Non-refundable rates and stays that have started can’t be cancelled in the app.' },
  { q: 'Are payments real?', a: 'Not in this build. Payments use a sandbox — no money is charged, and the test card ending 0002 always declines so you can see the failure flow.' },
];

export default function Help() {
  return (
    <Screen gap={16}>
      <AppBar title="Help & support" />
      {FAQ.map((f) => (
        <Card key={f.q} radius={24}>
          <View style={{ gap: 6 }}>
            <Txt variant="rowTitle">{f.q}</Txt>
            <Txt variant="body" color="text2">
              {f.a}
            </Txt>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
