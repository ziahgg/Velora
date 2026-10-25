import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Txt } from '@/components/Text';
import type { PaymentMethod } from '@/payments/adapter';

/** Simple brand marks for the method rows (Figma "Logo/Apple Pay · Mastercard · PayPal"). */
export function MethodLogo({ method }: { method: PaymentMethod }) {
  if (method.kind === 'paypal') {
    return (
      <Txt variant="heading" weight="extrabold" style={{ color: '#003087' }} accessibilityLabel="PayPal">
        P
      </Txt>
    );
  }
  if (method.kind === 'apple_pay') {
    return (
      <Txt variant="label" weight="bold" accessibilityLabel="Apple Pay">
        Pay
      </Txt>
    );
  }
  if (method.sandboxOutcome === 'declines') {
    return (
      <View accessibilityLabel="Test card">
        <Txt variant="captionMedium">TEST</Txt>
      </View>
    );
  }
  return (
    <Svg width={30} height={20} viewBox="0 0 30 20" accessibilityLabel="Mastercard">
      <Circle cx={11} cy={10} r={8} fill="#EB001B" />
      <Circle cx={19} cy={10} r={8} fill="#F79E1B" opacity={0.9} />
    </Svg>
  );
}
