import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState, Sheet } from '@/components/Feedback';
import { Icon, type IconName } from '@/components/Icon';
import { Txt } from '@/components/Text';
import type { Booking, Hotel } from '@/data/types';
import { daysUntil, effectiveStatus, formatCountdown, holdSecondsLeft } from '@/lib/booking';
import { formatRange, todayISO } from '@/lib/dates';
import { colors } from '@/theme/tokens';

export interface Reminder {
  id: string;
  icon: IconName;
  title: string;
  body: string;
  href: string;
}

/** Reminders derived from the user's own bookings (no push service is connected). */
export function deriveReminders(bookings: Booking[], hotels: Map<string, Hotel>, now = new Date()): Reminder[] {
  const today = todayISO(now);
  const out: Reminder[] = [];
  for (const b of bookings) {
    const hotel = hotels.get(b.hotelId);
    if (!hotel) continue;
    const status = effectiveStatus(b, now);
    if (status === 'pending_payment') {
      out.push({
        id: `pay-${b.id}`,
        icon: 'credit-card',
        title: `Finish paying for ${hotel.name}`,
        body: `Your room is held for ${formatCountdown(holdSecondsLeft(b.holdExpiresAt, now))} more minutes.`,
        href: `/booking/payment?bookingId=${b.id}`,
      });
    } else if (status === 'confirmed' && b.checkIn >= today) {
      const days = daysUntil(b.checkIn, today);
      if (days <= 30) {
        out.push({
          id: `trip-${b.id}`,
          icon: 'luggage',
          title: days === 0 ? `Check in today at ${hotel.name}` : `${hotel.name} in ${days} ${days === 1 ? 'day' : 'days'}`,
          body: `${formatRange(b.checkIn, b.checkOut)} · check-in from ${hotel.checkInTime}`,
          href: `/trip/${b.id}`,
        });
      }
    }
  }
  return out;
}

export function RemindersSheet({ visible, onClose, reminders }: { visible: boolean; onClose: () => void; reminders: Reminder[] }) {
  const router = useRouter();
  return (
    <Sheet visible={visible} onClose={onClose} title="Reminders">
      {reminders.length === 0 ? (
        <EmptyState icon="bell" title="You’re all caught up" body="Payment reminders and upcoming check-ins for your trips show up here." />
      ) : (
        <View style={{ gap: 10 }}>
          {reminders.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                router.push(r.href as never);
              }}
              style={styles.row}
            >
              <View style={styles.icon}>
                <Icon name={r.icon} size={18} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="label">{r.title}</Txt>
                <Txt variant="caption" color="text2">
                  {r.body}
                </Txt>
              </View>
              <Icon name="chevron-right" size={18} color="text3" />
            </Pressable>
          ))}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: colors.bg },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
