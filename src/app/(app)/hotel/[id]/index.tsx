import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/Button';
import { StayFact } from '@/components/Cards';
import { DevNote, EmptyState, ErrorState, FullScreenLoader, useToast } from '@/components/Feedback';
import { Icon, isIconName } from '@/components/Icon';
import { Footer } from '@/components/Layout';
import { Photo } from '@/components/Photo';
import { Rating, Tag } from '@/components/Pills';
import { Txt } from '@/components/Text';
import { useFavoriteToggle } from '@/features/favorites/useFavoriteToggle';
import { DatesGuestsSheet } from '@/features/search/DatesGuestsSheet';
import { formatDay, nightsBetween, plural } from '@/lib/dates';
import { guestsLabel, partyLabel } from '@/lib/format';
import { formatUSD, formatUSDShort } from '@/lib/money';
import { formatRate } from '@/lib/pricing';
import { fromPriceFor } from '@/lib/search';
import { useCatalog, useCatalogIndex } from '@/state/queries';
import { useSearch } from '@/state/search';
import { errorMessage } from '@/state/session';
import { colors, SIDE } from '@/theme/tokens';

const HERO = 440;
const TYPE = { villa: 'Villa', resort: 'Resort', hotel: 'Hotel', apartment: 'Apartment' } as const;

/** Figma 02 Hotel Detail. */
export default function HotelDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const catalog = useCatalog();
  const index = useCatalogIndex(catalog.data);
  const search = useSearch();
  const fav = useFavoriteToggle();
  const [page, setPage] = useState(0);
  const [datesOpen, setDatesOpen] = useState(false);
  const gallery = useRef<ScrollViewInstance>(null);

  const hotel = id ? index.hotels.get(id) : undefined;
  const from = hotel ? fromPriceFor(hotel, search.stay) : null;
  const nights = nightsBetween(search.stay.checkIn, search.stay.checkOut);
  const refundableRooms = hotel?.rooms.filter((r) => r.freeCancelDays !== null) ?? [];

  if (catalog.isPending) return <FullScreenLoader />;
  if (catalog.isError) return <View style={styles.fill}><ErrorState message={errorMessage(catalog.error)} onRetry={() => void catalog.refetch()} /></View>;
  if (!hotel) {
    return (
      <View style={[styles.fill, { paddingTop: insets.top + 80 }]}>
        <EmptyState icon="hotel" title="Stay not found" body="This stay is no longer listed." action={{ label: 'Back to Home', onPress: () => router.replace('/') }} />
      </View>
    );
  }

  const dest = index.destinations.get(hotel.destinationId);
  const amenities = hotel.amenityIds.map((a) => index.amenities.get(a)).filter((a): a is NonNullable<typeof a> => !!a && a.id !== 'private-pool' && a.id !== 'family');
  const saved = fav.isSaved(hotel.id);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  const showPhoto = (i: number) => gallery.current?.scrollTo({ x: i * width, animated: true });
  const openMaps = () => {
    const label = encodeURIComponent(hotel.name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${hotel.lat},${hotel.lng}`,
      android: `geo:${hotel.lat},${hotel.lng}?q=${hotel.lat},${hotel.lng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${hotel.lat},${hotel.lng}`,
    });
    Linking.openURL(url).catch(() => toast('Couldn’t open maps on this device.', { kind: 'error' }));
  };

  return (
    <View style={styles.fill}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ height: HERO }}>
          <ScrollView ref={gallery} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} onScroll={Platform.OS === 'web' ? onScroll : undefined} scrollEventThrottle={64}>
            {hotel.photos.map((p, i) => (
              <Photo key={`${p}-${i}`} photo={p} style={{ width, height: HERO }} label={i === 0 ? `${hotel.name} photo` : undefined} />
            ))}
          </ScrollView>
          <View style={[styles.heroBar, { top: insets.top + 8 }]}>
            <IconButton icon="arrow-left" label="Back" look="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
            <View style={{ flex: 1 }} />
            <IconButton icon="share" label="Share" look="glass" onPress={() => void Share.share({ message: `${hotel.name} — ${index.place(hotel)}. Found on Velora.` })} />
            <IconButton icon="heart" label={saved ? 'Remove from saved stays' : 'Save stay'} look="glass" iconColor={saved ? 'heart' : 'ink'} iconFill={saved ? 'heart' : undefined} onPress={() => fav.toggle(hotel.id)} />
          </View>
          <View style={styles.counter}>
            <Icon name="grid" size={16} color="onInk" />
            <Txt variant="captionMedium" color="onInk">
              {page + 1} / {hotel.photos.length} photos
            </Txt>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.tags}>
            <Tag label={TYPE[hotel.propertyType]} size="md" />
            <Tag label={`${plural(search.stay.adults, 'Adult')}, ${plural(search.stay.rooms, 'Room')}`} size="md" />
            {search.stay.children ? <Tag label={plural(search.stay.children, 'Child', 'Children')} size="md" /> : null}
          </View>

          <View style={{ gap: 8 }}>
            <Txt variant="title" accessibilityRole="header">
              {hotel.name}
            </Txt>
            <View style={styles.meta}>
              <Icon name="map-pin" size={16} color="text2" />
              <Txt variant="body" color="text2">
                {index.place(hotel)}
              </Txt>
              <View style={{ width: 8 }} />
              <Rating value={hotel.rating} look="none" />
              <Txt variant="body" color="text2">
                ({hotel.reviewCount.toLocaleString('en-US')} reviews)
              </Txt>
            </View>
          </View>

          <Txt variant="body" color="text2">
            {hotel.description}
          </Txt>

          <View style={styles.amenities}>
            {amenities.slice(0, 5).map((a) => (
              <View key={a.id} style={styles.amenity} accessible accessibilityLabel={a.label}>
                <View style={styles.amenityIcon}>
                  <Icon name={isIconName(a.icon) ? a.icon : 'check'} size={20} />
                </View>
                <Txt variant="captionMedium" color="text2" numberOfLines={1}>
                  {a.label.replace('Free ', '')}
                </Txt>
              </View>
            ))}
          </View>
          {amenities.length > 5 ? (
            <Txt variant="caption" color="text2" style={{ marginTop: -8 }}>
              Also: {amenities.slice(5).map((a) => a.label).join(' · ')}
            </Txt>
          ) : null}

          <Pressable accessibilityRole="button" accessibilityLabel="Change dates and guests" onPress={() => setDatesOpen(true)} style={styles.facts}>
            <StayFact label="Check-in" value={formatDay(search.stay.checkIn)} hint={`From ${hotel.checkInTime}`} />
            <StayFact label="Check-out" value={formatDay(search.stay.checkOut)} hint={plural(nights, 'night')} />
            <StayFact label="Guests" value={guestsLabel(search.stay)} hint={partyLabel(search.stay).replace(', ', ' · ')} />
          </Pressable>

          <View style={styles.galleryHead}>
            <Txt variant="subheading">Gallery</Txt>
            <Pressable accessibilityRole="button" onPress={() => showPhoto(0)} hitSlop={8}>
              <Txt variant="bodyMedium" color="text2">
                See all
              </Txt>
            </Pressable>
          </View>
          <View style={styles.thumbs}>
            {hotel.photos.slice(0, 4).map((p, i) => (
              <Pressable key={`${p}-${i}`} accessibilityRole="button" accessibilityLabel={`Show photo ${i + 1}`} onPress={() => showPhoto(i)} style={{ flex: 1 }}>
                <Photo photo={p} radius={18} style={{ height: 70 }}>
                  {i === 3 && hotel.photos.length > 4 ? (
                    <View style={styles.more}>
                      <Txt variant="label" color="onInk">
                        +{hotel.photos.length - 4}
                      </Txt>
                    </View>
                  ) : null}
                </Photo>
              </Pressable>
            ))}
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel={`Directions to ${hotel.address}`} onPress={openMaps} style={styles.location}>
            <View style={styles.locIcon}>
              <Icon name="map-pin" size={22} color="lime" />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Txt variant="label">{hotel.address}</Txt>
              <Txt variant="caption" color="text2">
                {hotel.locationNote}
              </Txt>
            </View>
            <Icon name="navigation" size={18} color="text2" />
          </Pressable>

          <View style={{ gap: 10 }}>
            <Txt variant="subheading">Good to know</Txt>
            <Policy icon="clock" text={`Check-in from ${hotel.checkInTime} · check-out until ${hotel.checkOutTime}`} />
            <Policy
              icon="circle-check"
              text={
                refundableRooms.length === hotel.rooms.length
                  ? 'Every room here has free cancellation until a few days before check-in.'
                  : refundableRooms.length
                    ? 'Some rooms have free cancellation; others are non-refundable. Each room shows its rule.'
                    : 'Rooms at this stay are non-refundable.'
              }
            />
            <Policy
              icon="receipt"
              text={`Prices are per night. Taxes (${formatRate(hotel.taxRateBps)})${hotel.resortFeePerNightCents ? ` and a ${formatUSD(hotel.resortFeePerNightCents)}/night resort fee` : ''} are added and shown in full before you pay.`}
            />
          </View>
          {catalog.data?.isSampleData ? <DevNote text={`Sample listing for development${dest ? ` in ${dest.name}` : ''}: rating, review count and prices are illustrative.`} /> : null}
        </View>
      </ScrollView>

      <Footer row>
        <View style={{ gap: 0 }}>
          <Txt variant="caption" color="text2">
            {from !== null ? 'Price from' : 'No rooms fit'}
          </Txt>
          {from !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
              <Txt variant="price">{formatUSDShort(from)}</Txt>
              <Txt variant="caption" color="text2">
                /night
              </Txt>
            </View>
          ) : (
            <Txt variant="label">{guestsLabel(search.stay)}</Txt>
          )}
        </View>
        <Button
          label={from !== null ? 'Select room' : 'Change guests'}
          onPress={() => (from !== null ? router.push(`/hotel/${hotel.id}/rooms`) : setDatesOpen(true))}
          style={{ flex: 1, marginLeft: 14 }}
        />
      </Footer>

      <DatesGuestsSheet
        visible={datesOpen}
        stay={search.stay}
        onClose={() => setDatesOpen(false)}
        onApply={(s) => {
          search.setStay(s);
          setDatesOpen(false);
          toast(`Dates updated · ${plural(nightsBetween(s.checkIn, s.checkOut), 'night')}`);
        }}
      />
    </View>
  );
}

function Policy({ icon, text }: { icon: 'clock' | 'circle-check' | 'receipt'; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Icon name={icon} size={18} color="text2" />
      <Txt variant="body" color="text2" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface },
  heroBar: { position: 'absolute', left: SIDE, right: SIDE, flexDirection: 'row', gap: 12 },
  counter: { position: 'absolute', left: SIDE, bottom: 56, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.glass, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  sheet: { marginTop: -34, backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 22, paddingHorizontal: SIDE, gap: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  amenities: { flexDirection: 'row', justifyContent: 'space-between' },
  amenity: { alignItems: 'center', gap: 8, width: 60 },
  amenityIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  facts: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, gap: 8 },
  galleryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  thumbs: { flexDirection: 'row', gap: 8, marginTop: -6 },
  more: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20,20,20,0.45)', alignItems: 'center', justifyContent: 'center' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg, borderRadius: 24, paddingVertical: 12, paddingLeft: 12, paddingRight: 14 },
  locIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
