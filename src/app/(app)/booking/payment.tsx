import * as Crypto from 'expo-crypto';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { AmountDueCard, FactPill, PaymentMethodRow } from '@/components/Cards';
import { ConfirmDialog, DevNote, EmptyState, ErrorState, FullScreenLoader, useToast } from '@/components/Feedback';
import { TextField } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { AppBar, Screen } from '@/components/Layout';
import { Photo } from '@/components/Photo';
import { Rating } from '@/components/Pills';
import { Txt } from '@/components/Text';
import { api } from '@/data';
import { MethodLogo } from '@/features/booking/MethodLogo';
import { PriceBreakdown } from '@/features/booking/PriceBreakdown';
import { useHoldCountdown } from '@/features/booking/useHoldCountdown';
import { effectiveStatus, formatCountdown } from '@/lib/booking';
import { formatRange, formatShort, plural } from '@/lib/dates';
import { partyLabel } from '@/lib/format';
import { formatUSD } from '@/lib/money';
import { billingSchema, fieldErrors } from '@/lib/validation';
import { payments } from '@/payments/adapter';
import { useBooking, useCatalog, useCatalogIndex, useProfile, useStoreBooking } from '@/state/queries';
import { errorMessage } from '@/state/session';
import { colors } from '@/theme/tokens';

/** Figma 03 Payment — pays the server-priced pending booking through the payment adapter. */
export default function Payment() {
  const { bookingId, method: preferred } = useLocalSearchParams<{ bookingId: string; method?: string }>();
  const router = useRouter();
  const toast = useToast();
  const booking = useBooking(bookingId);
  const catalog = useCatalog();
  const index = useCatalogIndex(catalog.data);
  const profile = useProfile();
  const storeBooking = useStoreBooking();
  const methods = payments.listMethods();
  const [methodId, setMethodId] = useState(() => (methods.some((m) => m.id === preferred) ? preferred! : methods[1].id));
  const [cardholder, setCardholder] = useState(() => profile.data?.fullName ?? '');
  const [receiptEmail, setReceiptEmail] = useState(() => profile.data?.email ?? '');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const paying = useRef(false);
  const secondsLeft = useHoldCountdown(booking.data?.holdExpiresAt);

  if (booking.isPending || catalog.isPending) return <FullScreenLoader />;
  if (booking.isError) {
    return (
      <Screen>
        <AppBar title="Payment" />
        <ErrorState message={errorMessage(booking.error)} onRetry={() => void booking.refetch()} />
      </Screen>
    );
  }
  const b = booking.data;
  const status = effectiveStatus(b);
  if (status === 'confirmed') return <Redirect href={{ pathname: '/booking/confirmed', params: { bookingId: b.id } }} />;

  const hotel = index.hotels.get(b.hotelId);
  const room = index.room(b.hotelId, b.roomTypeId);
  if (status !== 'pending_payment' || !hotel || !room) {
    return (
      <Screen>
        <AppBar title="Payment" onBack={() => router.replace('/trips')} />
        <EmptyState
          icon="clock"
          title={status === 'cancelled' ? 'Booking cancelled' : 'Your hold has ended'}
          body="No payment was taken. Check availability again to book this stay."
          action={hotel ? { label: 'Book again', onPress: () => router.replace(`/hotel/${hotel.id}/rooms`) } : { label: 'Back to Home', onPress: () => router.replace('/') }}
        />
      </Screen>
    );
  }

  const method = methods.find((m) => m.id === methodId) ?? methods[0];

  const pay = async () => {
    if (paying.current) return;
    setError(null);
    const e = fieldErrors(billingSchema, { cardholder, receiptEmail });
    setErrors(e);
    if (Object.keys(e).length) return;
    paying.current = true;
    setBusy(true);
    try {
      const result = await payments.charge({ bookingId: b.id, amountCents: b.quote.totalCents, method });
      const updated = await api.recordPayment(b.id, result, `pay-${Crypto.randomUUID()}`);
      storeBooking(updated);
      if (result.status === 'succeeded' && updated.status === 'confirmed') {
        router.replace({ pathname: '/booking/confirmed', params: { bookingId: b.id } });
      } else {
        router.push({ pathname: '/booking/declined', params: { bookingId: b.id, method: method.id } });
      }
    } catch (err) {
      setError(errorMessage(err));
      void booking.refetch();
    } finally {
      paying.current = false;
      setBusy(false);
    }
  };

  const cancelHold = async () => {
    setCancelling(true);
    try {
      storeBooking(await api.cancelBooking(b.id));
      setConfirmCancel(false);
      toast('Booking cancelled · No payment was taken');
      router.replace('/');
    } catch (err) {
      toast(errorMessage(err), { kind: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Screen gap={18} footer={<Button label={`Pay ${formatUSD(b.quote.totalCents)}`} onPress={pay} loading={busy} disabled={secondsLeft === 0} />}>
      <AppBar title="Payment" action={{ icon: 'ellipsis-vertical', label: 'Cancel this booking', onPress: () => setConfirmCancel(true) }} />

      <AmountDueCard totalCents={b.quote.totalCents} summary={`${room.name} · ${plural(b.quote.nights, 'night')} at ${hotel.name}`} />

      <View style={styles.summary}>
        <View style={styles.summaryHead}>
          <Photo photo={hotel.photos[0]} radius={20} style={{ width: 72, height: 72 }} />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt variant="rowTitle" numberOfLines={1}>
              {hotel.name}
            </Txt>
            <Txt variant="caption" color="text2" numberOfLines={1}>
              {room.name} · {room.bed}
            </Txt>
            <Rating value={hotel.rating} look="grey" />
          </View>
        </View>
        <View style={styles.facts}>
          <FactPill icon="calendar" label={formatRange(b.checkIn, b.checkOut)} />
          <FactPill icon="clock" label={plural(b.quote.nights, 'night')} />
          <FactPill icon="users" label={partyLabel(b)} />
        </View>
      </View>

      <View style={[styles.hold, secondsLeft < 120 ? { backgroundColor: colors.error50 } : null]} accessibilityLiveRegion="polite">
        <Icon name="clock" size={18} color={secondsLeft < 120 ? 'error' : 'text'} />
        <Txt variant="label" style={{ flex: 1 }} color={secondsLeft < 120 ? 'error' : 'text'}>
          {secondsLeft > 0 ? `We’re holding your room for ${formatCountdown(secondsLeft)} more minutes.` : 'Your hold has ended — no payment will be taken.'}
        </Txt>
      </View>

      <Txt variant="subheading">Price details</Txt>
      <PriceBreakdown quote={b.quote} />

      <Txt variant="subheading">Payment Method</Txt>
      <View style={styles.methods}>
        {methods.map((m) => (
          <PaymentMethodRow
            key={m.id}
            logo={<MethodLogo method={m} />}
            label={m.label}
            detail={m.detail}
            note={m.sandboxOutcome === 'declines' ? 'Sandbox test card — always declines' : undefined}
            selected={m.id === methodId}
            onPress={() => setMethodId(m.id)}
          />
        ))}
        <Button
          label="Add Payment Method"
          variant="dashed"
          icon="plus"
          onPress={() => toast('Adding cards needs a payment provider. Use a sandbox method to test.', { kind: 'error' })}
          style={{ marginTop: 6 }}
        />
      </View>

      <Txt variant="subheading">Billing details</Txt>
      <View style={styles.billing}>
        <TextField label="Cardholder name" icon="user" value={cardholder} onChangeText={setCardholder} error={errors.cardholder} autoComplete="name" />
        <TextField label="Email for receipt" icon="mail" value={receiptEmail} onChangeText={setReceiptEmail} error={errors.receiptEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      </View>

      {error ? (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <Icon name="circle-alert" size={18} color="error" />
          <Txt variant="caption" color="error" style={{ flex: 1 }}>
            {error}
          </Txt>
        </View>
      ) : null}

      <View style={styles.secure}>
        <Icon name="lock" size={16} color="text2" />
        <Txt variant="caption" color="text2" style={{ flex: 1 }}>
          {b.freeCancelUntil ? `Free cancellation until ${formatShort(b.freeCancelUntil)}.` : 'This rate is non-refundable.'} Card details never touch Velora’s servers.
        </Txt>
      </View>
      {payments.isSandbox ? <DevNote icon="credit-card" text="Sandbox payments: no real money is charged. Test methods succeed, except “Test card · declines”." /> : null}

      <ConfirmDialog
        visible={confirmCancel}
        title="Cancel this booking?"
        body="We’ll release the room. You haven’t been charged."
        confirmLabel="Cancel booking"
        destructive
        loading={cancelling}
        onConfirm={cancelHold}
        onCancel={() => setConfirmCancel(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: colors.surface, borderRadius: 30, padding: 10, paddingBottom: 14, gap: 12 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 4 },
  hold: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 20, padding: 14 },
  methods: { backgroundColor: colors.surface, borderRadius: 24, padding: 16, gap: 8 },
  billing: { backgroundColor: colors.surface, borderRadius: 30, padding: 16, gap: 14 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.error50, padding: 12, borderRadius: 16 },
  secure: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 4 },
});
