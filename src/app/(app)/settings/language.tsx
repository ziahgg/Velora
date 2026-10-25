import { AppBar, Card, Row, Screen } from '@/components/Layout';
import { Txt } from '@/components/Text';

export default function LanguageCurrency() {
  return (
    <Screen gap={16}>
      <AppBar title="Language & currency" />
      <Card radius={24}>
        <Row label="Language" value="English" />
        <Row label="Currency" value="US dollar (USD)" />
      </Card>
      <Txt variant="caption" color="text2">
        Prices, taxes and fees are quoted and charged in USD. Other languages and currencies aren’t available yet — Velora doesn’t convert prices without a reliable exchange-rate source.
      </Txt>
    </Screen>
  );
}
