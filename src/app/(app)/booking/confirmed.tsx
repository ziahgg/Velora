import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { StayFact } from '@/components/Cards';
import { ErrorState, FullScreenLoader, StateHero } from '@/components/Feedback';
import { Divider, Screen } from '@/components/Layout';
import { Photo } from '@/components/Photo';
import { Tag } from '@/components/Pills';
import { Txt } from '@/components/Text';
import { effectiveStatus } from '@/lib/booking';
import { formatDay } from '@/lib/dates';
import { formatUSD } from '@/lib/money';
import { useBooking, useCatalog, useCatalogIndex } from '@/state/queries';
import { errorMessage } from '@/state/session';
import { colors } from '@/theme/tokens';

/** Figma 06 Booking Confirmed. Reads the stored booking, so it also works after a restart. */
export default function Confirmed() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const booking = useBooking(bookingId);
  const catalog = useCatalog();
  const index = useCatalogIndex(catalog.data);

  if (booking.isPending || catalog.isPending) return <FullScreenLoader />;
  if (booking.isError) {
    return (
      <Screen contentStyle={{ paddingTop: 100 }}>
        <ErrorState message={errorMessage(booking.error)} onRetry={() => void booking.refetch()} secondary={{ label: 'Open my trips', onPress: () => router.replace('/trips') }} />
      </Screen>
    );
  }
  const b = booking.data;
  const hotel = index.hotels.get(b.hotelId);
  const room = index.room(b.hotelId, b.roomTypeId);
  const confirmed = effectiveStatus(b) === 'confirmed';

  return (
    <Screen
      gap={16}
      contentStyle={{ paddingTop: 70 }}
      footer={
        <>
          <Button label="View my trip" onPress={() => router.replace(`/trip/${b.id}`)} />
          <Button label="Back to Home" variant="tonal" onPress={() => router.replace('/')} />
        </>
      }
    >
      <StateHero icon={confirmed ? 'check' : 'clock'} tone={confirmed ? 'success' : 'ink'} />
      <Txt variant="display" size={32} align="center" accessibilityRole="header">
        {confirmed ? 'Booking confirmed!' : 'Booking not confirmed'}
      </Txt>
      <Txt variant="body" color="text2" align="center">
        {confirmed
          ? `Your ${room?.category ?? 'room'} in ${hotel?.area ?? 'your destination'} is reserved. Your voucher is saved in My Trips.`
          : 'We haven’t received a successful payment for this booking yet.'}
      </Txt>

      <View style={styles.card}>
        <Photo photo={hotel?.photos[0]} radius={22} style={{ height: 140 }} />
        <View style={{ paddingHorizontal: 12, gap: 14 }}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Txt variant="subheading" numberOfLines={1}>
                {hotel?.name}
              </Txt>
              <Txt variant="caption" color="text2" numberOfLines={1}>
                {room?.name}
              </Txt>
            </View>
            <Tag label={confirmed ? 'Confirmed' : 'Pending'} look={confirmed ? 'selected' : 'outline'} size="md" />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StayFact label="Check-in" value={formatDay(b.checkIn)} />
            <StayFact label="Check-out" value={formatDay(b.checkOut)} />
            <StayFact label="Guests" value={String(b.adults + b.children)} />
          </View>
          <Divider dashed />
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Txt variant="caption" color="text2">
                Booking ID
              </Txt>
              <Txt variant="label" selectable>
                {b.reference}
              </Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt variant="caption" color="text2">
                {b.paymentStatus === 'paid' ? `Paid · ${b.paidWith ?? ''}` : 'Not paid'}
              </Txt>
              <Txt variant="heading" size={22}>
                {formatUSD(b.quote.totalCents)}
              </Txt>
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 30, padding: 8, paddingBottom: 18, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
