import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { StayFact } from '@/components/Cards';
import { ConfirmDialog, ErrorState, FullScreenLoader, useToast } from '@/components/Feedback';
import { Icon } from '@/components/Icon';
import { AppBar, Divider, Row, Screen } from '@/components/Layout';
import { Photo } from '@/components/Photo';
import { Tag } from '@/components/Pills';
import { Txt } from '@/components/Text';
import { api } from '@/data';
import { cancellationText, PriceBreakdown } from '@/features/booking/PriceBreakdown';
import { cancellationAllowed, effectiveStatus } from '@/lib/booking';
import { formatDay, todayISO } from '@/lib/dates';
import { partyLabel } from '@/lib/format';
import { useBooking, useCatalog, useCatalogIndex, useStoreBooking } from '@/state/queries';
import { errorMessage } from '@/state/session';
import { colors } from '@/theme/tokens';

const STATUS_LABEL = { pending_payment: 'Awaiting payment', confirmed: 'Confirmed', cancelled: 'Cancelled', expired: 'Hold expired' } as const;
const PAYMENT_LABEL = { unpaid: 'Not paid', paid: 'Paid', failed: 'Last payment declined', voided: 'Voided (sandbox — no money moved)' } as const;

/** Booking details / voucher, with cancellation when the policy and backend allow it. */
export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const booking = useBooking(id);
  const catalog = useCatalog();
  const index = useCatalogIndex(catalog.data);
  const storeBooking = useStoreBooking();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (booking.isPending || catalog.isPending) return <FullScreenLoader />;
  if (booking.isError) {
    return (
      <Screen>
        <AppBar title="Trip" />
        <ErrorState message={errorMessage(booking.error)} onRetry={() => void booking.refetch()} />
      </Screen>
    );
  }
  const b = booking.data;
  const hotel = index.hotels.get(b.hotelId);
  const room = index.room(b.hotelId, b.roomTypeId);
  const status = effectiveStatus(b);
  const rule = cancellationAllowed(b, todayISO());

  const cancel = async () => {
    setBusy(true);
    try {
      const updated = await api.cancelBooking(b.id);
      storeBooking(updated);
      setConfirm(false);
      toast(updated.paymentStatus === 'voided' ? 'Booking cancelled · sandbox payment voided' : 'Booking cancelled');
    } catch (err) {
      toast(errorMessage(err), { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const confirmBody =
    status === 'pending_payment'
      ? 'We’ll release the room. You haven’t been charged.'
      : rule.refundable
        ? 'You’re within free cancellation. In this sandbox build no real refund is issued — the test payment is marked as voided.'
        : 'This booking is past its free-cancellation date, so the payment isn’t refunded.';

  return (
    <Screen
      gap={16}
      footer={
        status === 'pending_payment' ? (
          <Button label="Complete payment" onPress={() => router.push({ pathname: '/booking/payment', params: { bookingId: b.id } })} />
        ) : hotel && status === 'confirmed' ? (
          <Button label="Directions" icon="navigation" variant="tonal" onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${hotel.lat},${hotel.lng}`)} />
        ) : undefined
      }
    >
      <AppBar title="Voucher" onBack={() => (router.canGoBack() ? router.back() : router.replace('/trips'))} />

      <View style={styles.card}>
        <Photo photo={hotel?.photos[0]} radius={22} style={{ height: 150 }} />
        <View style={{ paddingHorizontal: 8, gap: 12 }}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Txt variant="heading">{hotel?.name}</Txt>
              <Txt variant="caption" color="text2">
                {room?.name} · {hotel ? index.place(hotel) : ''}
              </Txt>
            </View>
            <Tag label={STATUS_LABEL[status]} look={status === 'confirmed' ? 'selected' : status === 'pending_payment' ? 'lime' : 'outline'} size="md" />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StayFact label="Check-in" value={formatDay(b.checkIn)} hint={hotel ? `From ${hotel.checkInTime}` : undefined} />
            <StayFact label="Check-out" value={formatDay(b.checkOut)} hint={hotel ? `Until ${hotel.checkOutTime}` : undefined} />
          </View>
          <Divider dashed />
          <Row label="Booking ID" value={b.reference} />
          <Row label="Guests" value={`${partyLabel(b)}${b.rooms > 1 ? ` · ${b.rooms} rooms` : ''}`} />
          <Row label="Lead guest" value={b.guestName} />
          <Row label="Phone" value={b.guestPhone} />
          {b.specialRequests ? <Row label="Requests" value={b.specialRequests} /> : null}
          <Row label="Payment" value={`${PAYMENT_LABEL[b.paymentStatus]}${b.paidWith && b.paymentStatus === 'paid' ? ` · ${b.paidWith}` : ''}`} muted />
        </View>
      </View>

      <Txt variant="subheading">Price details</Txt>
      <PriceBreakdown quote={b.quote} />

      <View style={styles.note}>
        <Icon name="info" size={16} color="text2" />
        <Txt variant="caption" color="text2" style={{ flex: 1 }}>
          {cancellationText(b.freeCancelUntil)}
        </Txt>
      </View>

      {rule.allowed ? (
        <Button label={status === 'pending_payment' ? 'Cancel booking' : 'Cancel this stay'} variant="secondary" onPress={() => setConfirm(true)} style={{ borderWidth: 1, borderColor: colors.error }} />
      ) : rule.reason && status === 'confirmed' ? (
        <Txt variant="caption" color="text3" align="center">
          {rule.reason}
        </Txt>
      ) : null}

      <ConfirmDialog
        visible={confirm}
        title={status === 'pending_payment' ? 'Cancel this booking?' : 'Cancel this stay?'}
        body={confirmBody}
        confirmLabel="Cancel booking"
        destructive
        loading={busy}
        onConfirm={cancel}
        onCancel={() => setConfirm(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 30, padding: 8, paddingBottom: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  note: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
});
