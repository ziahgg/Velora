import { StyleSheet, View } from 'react-native';

import { Divider } from '@/components/Layout';
import { Txt } from '@/components/Text';
import type { PriceQuote } from '@/data/types';
import { formatDayNoComma, plural, type ISODate } from '@/lib/dates';
import { formatUSD, formatUSDShort } from '@/lib/money';
import { formatRate } from '@/lib/pricing';
import { colors } from '@/theme/tokens';

/** "Price details" card from the Review and Payment frames. Renders a quote; never computes its own total. */
export function PriceBreakdown({ quote }: { quote: PriceQuote }) {
  const rooms = quote.rooms > 1 ? ` × ${quote.rooms} rooms` : '';
  return (
    <View style={styles.card}>
      <Line label={`${formatUSD(quote.nightlyRateCents)} × ${plural(quote.nights, 'night')}${rooms}`} value={formatUSD(quote.subtotalCents)} />
      <Line label={`Taxes (${formatRate(quote.taxRateBps)})`} value={formatUSD(quote.taxCents)} />
      {quote.feesCents ? <Line label={`Resort fee · ${formatUSDShort(quote.resortFeePerNightCents)} × ${plural(quote.nights, 'night')}${rooms}`} value={formatUSD(quote.feesCents)} /> : null}
      <Divider />
      <View style={styles.total}>
        <Txt variant="label">Total (USD)</Txt>
        <Txt variant="heading" accessibilityLabel={`Total ${formatUSD(quote.totalCents)}`}>
          {formatUSD(quote.totalCents)}
        </Txt>
      </View>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Txt variant="body" color="text2" style={{ flexShrink: 1 }}>
        {label}
      </Txt>
      <Txt variant="label">{value}</Txt>
    </View>
  );
}

/** Human cancellation rule for a stay. */
export function cancellationText(freeCancelUntil: ISODate | null): string {
  return freeCancelUntil
    ? `Free cancellation until ${formatDayNoComma(freeCancelUntil)}, 23:59 hotel time. After that, cancelling isn’t refunded.`
    : 'This rate is non-refundable: cancelling won’t be refunded.';
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 30, paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 29 },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
});
