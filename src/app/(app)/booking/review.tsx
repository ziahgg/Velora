import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState, FullScreenLoader, useToast } from '@/components/Feedback';
import { Checkbox, TextField } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { AppBar, Screen } from '@/components/Layout';
import { Photo } from '@/components/Photo';
import { Rating } from '@/components/Pills';
import { Txt } from '@/components/Text';
import { api } from '@/data';
import { cancellationText, PriceBreakdown } from '@/features/booking/PriceBreakdown';
import { DatesGuestsSheet } from '@/features/search/DatesGuestsSheet';
import { formatDayNoComma, nightsBetween, plural, todayISO } from '@/lib/dates';
import { partyLabel } from '@/lib/format';
import { fitsParty, freeCancelUntil, quoteStay, validateStay } from '@/lib/pricing';
import { fieldErrors, guestSchema } from '@/lib/validation';
import { queryClient, errorMessage } from '@/state/session';
import { keys, useCatalog, useCatalogIndex, useProfile, useStoreBooking } from '@/state/queries';
import { useSearch } from '@/state/search';
import { colors } from '@/theme/tokens';
import { AppError } from '@/data/service';

/** Figma 05 Booking Review — summary, guest details, price and conditions, then a pending booking. */
export default function Review() {
  const { hotelId, roomId } = useLocalSearchParams<{ hotelId: string; roomId: string }>();
  const router = useRouter();
  const toast = useToast();
  const catalog = useCatalog();
  const index = useCatalogIndex(catalog.data);
  const profile = useProfile();
  const storeBooking = useStoreBooking();
  const search = useSearch();
  const { stay } = search;
  const [datesOpen, setDatesOpen] = useState(false);
  // Prefilled from the profile (already cached by Home); the guest can edit both.
  const [guestName, setGuestName] = useState(() => profile.data?.fullName ?? '');
  const [guestPhone, setGuestPhone] = useState(() => profile.data?.phone ?? '');
  const [requests, setRequests] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  // One key per visit + stay, so a double tap or retry returns the same pending booking.
  const [visitKey] = useState(() => Crypto.randomUUID());

  const hotel = hotelId ? index.hotels.get(hotelId) : undefined;
  const room = hotel && roomId ? index.room(hotel.id, roomId) : undefined;

  const stayError = validateStay(stay, todayISO());
  const quote = useMemo(
    () =>
      hotel && room && !stayError
        ? quoteStay({ nightlyRateCents: room.pricePerNightCents, checkIn: stay.checkIn, checkOut: stay.checkOut, rooms: stay.rooms, taxRateBps: hotel.taxRateBps, resortFeePerNightCents: hotel.resortFeePerNightCents })
        : null,
    [hotel, room, stay, stayError],
  );

  if (catalog.isPending) return <FullScreenLoader />;
  if (!hotel || !room) {
    return (
      <Screen>
        <AppBar title="Review booking" />
        <EmptyState icon="hotel" title="Room not found" body="This room is no longer available. Choose another one." action={{ label: 'Back to Home', onPress: () => router.replace('/') }} />
      </Screen>
    );
  }

  const fits = fitsParty(room.maxGuests, stay);
  const cancelUntil = freeCancelUntil(stay.checkIn, room.freeCancelDays);

  const submit = async () => {
    if (submitting.current) return;
    setFormError(null);
    const e = fieldErrors(guestSchema, { guestName, guestPhone, specialRequests: requests });
    if (!accepted) e.terms = 'Please accept the booking conditions.';
    setErrors(e);
    if (Object.keys(e).length || stayError || !fits || !quote) {
      if (stayError) setFormError(stayError);
      else if (!fits) setFormError(`${room.name} sleeps up to ${room.maxGuests} per room — change guests or rooms.`);
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const fingerprint = [hotel.id, room.id, stay.checkIn, stay.checkOut, stay.adults, stay.children, stay.rooms].join(':');
      const booking = await api.createBooking({
        hotelId: hotel.id,
        roomTypeId: room.id,
        ...stay,
        guestName,
        guestPhone,
        specialRequests: requests,
        expectedTotalCents: quote.totalCents,
        idempotencyKey: `${visitKey}:${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, fingerprint).then((h) => h.slice(0, 16))}`,
      });
      storeBooking(booking);
      router.push({ pathname: '/booking/payment', params: { bookingId: booking.id } });
    } catch (err) {
      if (err instanceof AppError && err.code === 'price_changed') void queryClient.invalidateQueries({ queryKey: keys.catalog });
      setFormError(errorMessage(err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  return (
    <Screen gap={16} footer={<Button label="Continue to Payment" onPress={submit} loading={busy} disabled={!quote} />}>
      <AppBar title="Review booking" />

      <View style={styles.hotel}>
        <Photo photo={hotel.photos[0]} radius={22} style={{ height: 150 }} />
        <View style={{ paddingHorizontal: 8, gap: 8 }}>
          <Txt variant="heading">{hotel.name}</Txt>
          <View style={styles.meta}>
            <Icon name="map-pin" size={16} color="text2" />
            <Txt variant="caption" color="text2">
              {index.place(hotel)}
            </Txt>
            <View style={{ width: 6 }} />
            <Rating value={hotel.rating} look="grey" />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Detail label="Dates" value={stayError ? 'Choose valid dates' : `${formatDayNoComma(stay.checkIn)} – ${formatDayNoComma(stay.checkOut)} · ${plural(nights, 'night')}`} onEdit={() => setDatesOpen(true)} />
        <Detail label="Guests" value={`${partyLabel(stay)}${stay.rooms > 1 ? ` · ${stay.rooms} rooms` : ''}`} onEdit={() => setDatesOpen(true)} />
        <Detail label="Room" value={`${room.name}${room.breakfastIncluded ? ' · Breakfast included' : ''}`} onEdit={() => router.back()} />
      </View>

      <Txt variant="subheading">Guest information</Txt>
      <View style={[styles.card, { gap: 14 }]}>
        <TextField label="Full name" icon="user" value={guestName} onChangeText={setGuestName} error={errors.guestName} autoComplete="name" />
        <TextField label="Phone" icon="phone" value={guestPhone} onChangeText={setGuestPhone} error={errors.guestPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="+62 812 3456 7890" />
        <TextField label="Special requests (optional)" value={requests} onChangeText={setRequests} error={errors.specialRequests} placeholder="e.g. late check-in, baby cot" multiline maxLength={300} />
      </View>

      <Txt variant="subheading">Price details</Txt>
      {quote ? <PriceBreakdown quote={quote} /> : null}

      <View style={styles.note}>
        <Icon name="info" size={16} color="text2" />
        <Txt variant="caption" color="text2" style={{ flex: 1 }}>
          {cancellationText(cancelUntil)} Final price is confirmed by Velora when you continue.
        </Txt>
      </View>

      <Checkbox checked={accepted} onChange={setAccepted}>
        <Txt variant="caption" color={errors.terms ? 'error' : 'text2'}>
          I’ve read the cancellation policy and agree to the booking conditions.
        </Txt>
      </Checkbox>

      {formError ? (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <Icon name="circle-alert" size={18} color="error" />
          <Txt variant="caption" color="error" style={{ flex: 1 }}>
            {formError}
          </Txt>
        </View>
      ) : null}

      <DatesGuestsSheet
        visible={datesOpen}
        stay={stay}
        onClose={() => setDatesOpen(false)}
        onApply={(s) => {
          search.setStay(s);
          setDatesOpen(false);
          toast(`Dates updated · ${plural(nightsBetween(s.checkIn, s.checkOut), 'night')}`);
        }}
      />
    </Screen>
  );
}

function Detail({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <View style={styles.detail}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="caption" color="text2">
          {label}
        </Txt>
        <Txt variant="rowTitle">{value}</Txt>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label.toLowerCase()}`} onPress={onEdit} hitSlop={10}>
        <Txt variant="label" color="text2">
          Edit
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hotel: { backgroundColor: colors.surface, borderRadius: 30, padding: 8, paddingBottom: 16, gap: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 30, padding: 16, gap: 18 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  note: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.error50, padding: 12, borderRadius: 16 },
});
