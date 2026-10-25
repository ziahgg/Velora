import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Destination, Hotel } from '@/data/types';
import { formatUSD, formatUSDShort } from '@/lib/money';
import { colors } from '@/theme/tokens';
import { Button, IconButton } from './Button';
import { Radio } from './Fields';
import { Icon, type IconName } from './Icon';
import { Photo } from './Photo';
import { Rating, Tag } from './Pills';
import { Txt } from './Text';

/** "$579 /night" stacked price (cards) or inline (rows). */
export function Price({ cents, inline, size = 20 }: { cents: number; inline?: boolean; size?: number }) {
  return (
    <View style={inline ? styles.priceInline : styles.priceStack} accessible accessibilityLabel={`${formatUSDShort(cents)} per night`}>
      <Txt variant="heading" size={size}>
        {formatUSDShort(cents)}
      </Txt>
      <Txt variant="caption" color="text2">
        /night
      </Txt>
    </View>
  );
}

function Heart({ saved, onToggle, size = 44, name }: { saved: boolean; onToggle: () => void; size?: number; name: string }) {
  return (
    <IconButton
      icon="heart"
      size={size}
      iconSize={size > 40 ? 20 : 17}
      label={saved ? `Remove ${name} from saved stays` : `Save ${name}`}
      iconColor={saved ? 'heart' : 'ink'}
      iconFill={saved ? 'heart' : undefined}
      onPress={onToggle}
    />
  );
}

/**
 * Figma "Card/Hotel Card" (290 wide, carousel) and "— Full width" (results):
 * photo with rating + heart, and a white info panel layered 24 px over the photo.
 */
export function HotelCard({
  hotel,
  place,
  priceCents,
  tags,
  saved,
  onToggleSave,
  onPress,
  width,
}: {
  hotel: Hotel;
  place: string;
  priceCents: number;
  tags: string[];
  saved: boolean;
  onToggleSave: () => void;
  onPress: () => void;
  /** Fixed width for carousels; omit for full width. */
  width?: number;
}) {
  const photoH = width ? 220 : 200;
  return (
    <View style={[styles.hotel, width ? { width } : null]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${hotel.name}, ${place}, from ${formatUSDShort(priceCents)} per night`} onPress={onPress}>
      <Photo photo={hotel.photos[0]} style={{ height: photoH }}>
        <View style={styles.hotelTop}>
          <Rating value={hotel.rating} />
        </View>
      </Photo>
      <View style={styles.hotelInfo}>
        <View style={styles.loc}>
          <Icon name="map-pin" size={14} color="text2" />
          <Txt variant="caption" color="text2" numberOfLines={1}>
            {place}
          </Txt>
        </View>
        <View style={styles.nameRow}>
          <Txt variant="cardTitle" numberOfLines={2} style={{ flex: 1 }}>
            {hotel.name}
          </Txt>
          <Price cents={priceCents} />
        </View>
        <View style={styles.tags}>
          {tags.map((t) => (
            <Tag key={t} label={t} />
          ))}
        </View>
      </View>
      </Pressable>
      <View style={styles.heartSpot}>
        <Heart saved={saved} onToggle={onToggleSave} name={hotel.name} />
      </View>
    </View>
  );
}

/** Figma "Card/Stay Row": 84 px thumbnail, name, location, rating pill, price. */
export function StayRow({ hotel, place, priceCents, onPress, subtitle }: { hotel: Hotel; place: string; priceCents: number; onPress: () => void; subtitle?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${hotel.name}, ${place}`} onPress={onPress} style={({ pressed }) => [styles.stayRow, pressed ? { opacity: 0.9 } : null]}>
      <Photo photo={hotel.photos[0]} radius={18} style={{ width: 84, height: 84 }} />
      <View style={{ flex: 1, gap: 5 }}>
        <Txt variant="rowTitle" numberOfLines={1}>
          {hotel.name}
        </Txt>
        <View style={styles.loc}>
          <Icon name="map-pin" size={13} color="text2" />
          <Txt variant="caption" color="text2" numberOfLines={1}>
            {subtitle ?? place}
          </Txt>
        </View>
        <View style={styles.rowBottom}>
          <Rating value={hotel.rating} look="grey" />
          <Price cents={priceCents} inline size={16} />
        </View>
      </View>
    </Pressable>
  );
}

/** Figma "Card/Destination": 124×164 photo card with a dark gradient and name + stay count. */
export function DestinationCard({ destination, stays, onPress, width = 124, height = 164 }: { destination: Destination; stays: number; onPress: () => void; width?: number; height?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${destination.name}, ${stays} stays`} onPress={onPress}>
      <Photo photo={destination.photo} radius={24} style={{ width, height }}>
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)']} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.destText}>
          <Txt variant="subheading" color="onInk">
            {destination.name}
          </Txt>
          <Txt variant="caption" color="onInk" style={{ opacity: 0.8 }}>
            {stays === 1 ? '1 stay' : `${stays} stays`}
          </Txt>
        </View>
      </Photo>
    </Pressable>
  );
}

/** Saved-stays grid card (15 Favorites). */
export function SavedCard({ hotel, place, priceCents, onPress, onUnsave }: { hotel: Hotel; place: string; priceCents: number; onPress: () => void; onUnsave: () => void }) {
  return (
    <View style={styles.savedWrap}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${hotel.name}, ${place}`} onPress={onPress} style={styles.saved}>
      <Photo photo={hotel.photos[0]} radius={18} style={{ height: 130 }} />
      <View style={{ paddingHorizontal: 6, gap: 3 }}>
        <Txt variant="label" numberOfLines={1}>
          {hotel.name}
        </Txt>
        <Txt variant="caption" color="text2" numberOfLines={1}>
          {place}
        </Txt>
        <View style={[styles.rowBottom, { marginTop: 4 }]}>
          <Price cents={priceCents} inline size={16} />
          <Rating value={hotel.rating} look="grey" />
        </View>
      </View>
    </Pressable>
      <View style={{ position: 'absolute', top: 12, right: 12 }}>
        <Heart saved onToggle={onUnsave} size={34} name={hotel.name} />
      </View>
    </View>
  );
}

/** Figma "Card/Trip Card": photo with lime countdown, name, room · reference, status, facts, two actions. */
export function TripCard({
  photo,
  countdown,
  title,
  subtitle,
  status,
  facts,
  primary,
  secondary,
  onPress,
}: {
  photo: string;
  countdown?: string;
  title: string;
  subtitle: string;
  status: { label: string; tone: 'ink' | 'outline' | 'lime' };
  facts: string[];
  primary?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  onPress: () => void;
}) {
  return (
    <View style={styles.trip}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${status.label}`} onPress={onPress} style={{ gap: 12 }}>
      <Photo photo={photo} radius={22} style={{ height: 150 }}>
        {countdown ? (
          <View style={styles.countdown}>
            <Txt variant="captionMedium" color="ink">
              {countdown}
            </Txt>
          </View>
        ) : null}
      </Photo>
      <View style={{ paddingHorizontal: 8, gap: 10 }}>
        <View style={styles.tripHead}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="subheading" numberOfLines={1}>
              {title}
            </Txt>
            <Txt variant="caption" color="text2" numberOfLines={1}>
              {subtitle}
            </Txt>
          </View>
          <Tag label={status.label} look={status.tone === 'ink' ? 'selected' : status.tone === 'lime' ? 'lime' : 'outline'} />
        </View>
        <View style={styles.tags}>
          {facts.map((f) => (
            <View key={f} style={styles.fact}>
              <Txt variant="captionMedium">{f}</Txt>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
      <View style={{ paddingHorizontal: 8 }}>
        {primary || secondary ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {primary ? <Button label={primary.label} size="medium" onPress={primary.onPress} style={{ flex: 1 }} /> : null}
            {secondary ? <Button label={secondary.label} size="medium" variant="tonal" onPress={secondary.onPress} style={{ flex: 1 }} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Figma "Payment/Amount Due Card": dark gradient, grey label, 40 px amount, translucent summary pill. */
export function AmountDueCard({ totalCents, summary }: { totalCents: number; summary: string }) {
  return (
    <LinearGradient colors={['#2B2B2B', '#0F0F0F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.amount}>
      <View style={{ paddingHorizontal: 8, gap: 2 }}>
        <Txt variant="body" color="text3">
          Amount Due
        </Txt>
        <Txt variant="amountDue" color="onInk" accessibilityLabel={`Amount due ${formatUSD(totalCents)}`}>
          {formatUSD(totalCents)}
        </Txt>
      </View>
      <View style={styles.amountPill}>
        <Txt variant="body" color="onInk" style={{ opacity: 0.85 }} numberOfLines={1}>
          {summary}
        </Txt>
      </View>
    </LinearGradient>
  );
}

/** Figma "Payment/Method Row": logo tile, name + masked detail, radio. Selected rows get a grey fill. */
export function PaymentMethodRow({ logo, label, detail, selected, onPress, note }: { logo: React.ReactNode; label: string; detail: string; selected: boolean; onPress: () => void; note?: string }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${detail}${note ? `, ${note}` : ''}`}
      onPress={onPress}
      style={[styles.method, selected ? { backgroundColor: colors.bg } : null]}
    >
      <View style={styles.logo}>{logo}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="rowTitle">{label}</Txt>
        <Txt variant="caption" color={note ? 'error' : 'text2'}>
          {note ?? detail}
        </Txt>
      </View>
      <Radio selected={selected} />
    </Pressable>
  );
}

/** Figma "Detail/Stay Fact": label, value, hint. */
export function StayFact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={{ gap: 3, flex: 1 }}>
      <Txt variant="caption" color="text2">
        {label}
      </Txt>
      <Txt variant="label" numberOfLines={1}>
        {value}
      </Txt>
      {hint ? (
        <Txt variant="caption" color="text3" numberOfLines={1}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/** Small grey pill with an icon (payment summary facts: dates, nights, guests). */
export function FactPill({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.factPill}>
      <Icon name={icon} size={16} color="text2" />
      <Txt variant="captionMedium">{label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  priceStack: { alignItems: 'flex-end' },
  priceInline: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  hotel: { backgroundColor: colors.surface, borderRadius: 30, overflow: 'hidden' },
  hotelTop: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, paddingTop: 16 },
  heartSpot: { position: 'absolute', top: 12, right: 12 },
  hotelInfo: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -24, padding: 16, gap: 8 },
  loc: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stayRow: { backgroundColor: colors.surface, borderRadius: 24, padding: 8, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  destText: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  savedWrap: { flex: 1 },
  saved: { flex: 1, backgroundColor: colors.surface, borderRadius: 24, padding: 6, paddingBottom: 12, gap: 8 },
  trip: { backgroundColor: colors.surface, borderRadius: 30, padding: 8, paddingBottom: 14, gap: 12 },
  tripHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countdown: { position: 'absolute', top: 12, left: 12, backgroundColor: colors.lime, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  fact: { backgroundColor: colors.bg, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 10 },
  amount: { borderRadius: 28, paddingTop: 18, padding: 10, gap: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  amountPill: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 18 },
  logo: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  factPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 10 },
});
