import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { ConfirmDialog, ErrorState, Skeleton, useToast } from '@/components/Feedback';
import { Icon } from '@/components/Icon';
import { PageTitle, Screen } from '@/components/Layout';
import { MenuGroup, MenuRow } from '@/components/MenuRow';
import { Txt } from '@/components/Text';
import { api } from '@/data';
import { effectiveStatus } from '@/lib/booking';
import { payments } from '@/payments/adapter';
import { useBookings, useFavorites, useProfile } from '@/state/queries';
import { errorMessage } from '@/state/session';
import { colors } from '@/theme/tokens';

/** Figma 16 Profile. */
export default function Profile() {
  const router = useRouter();
  const toast = useToast();
  const profile = useProfile();
  const bookings = useBookings();
  const favorites = useFavorites();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => {
    const done = (bookings.data ?? []).filter((b) => effectiveStatus(b) === 'confirmed');
    return { trips: done.length, nights: done.reduce((n, b) => n + b.quote.nights, 0), saved: favorites.data?.length ?? 0 };
  }, [bookings.data, favorites.data]);

  const signOut = async () => {
    setBusy(true);
    try {
      await api.signOut();
    } catch (e) {
      toast(errorMessage(e), { kind: 'error', aboveNav: true });
      setBusy(false);
    }
  };

  return (
    <Screen withNav gap={16}>
      <PageTitle title="Profile" />

      {profile.isError ? (
        <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
      ) : (
        <View style={styles.card}>
          {profile.data ? <Avatar name={profile.data.fullName || profile.data.email} size={60} dark /> : <Skeleton width={60} height={60} radius={30} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading" color="onInk" numberOfLines={1}>
              {profile.data?.fullName || 'Traveller'}
            </Txt>
            <Txt variant="body" color="text3" numberOfLines={1}>
              {profile.data?.email ?? ''}
            </Txt>
          </View>
          <View style={styles.badge}>
            <Icon name="star" size={14} color="ink" />
            <Txt variant="label" color="ink">
              {api.mode === 'demo' ? 'Demo' : 'Member'}
            </Txt>
          </View>
        </View>
      )}

      <View style={styles.stats}>
        <Stat value={stats.trips} label={stats.trips === 1 ? 'Trip' : 'Trips'} />
        <Stat value={stats.nights} label={stats.nights === 1 ? 'Night' : 'Nights'} />
        <Stat value={stats.saved} label="Saved" />
      </View>

      <MenuGroup title="Account">
        <MenuRow icon="user" label="Personal information" onPress={() => router.push('/settings/personal')} />
        <MenuRow icon="credit-card" label="Payment methods" value={payments.isSandbox ? 'Sandbox' : undefined} onPress={() => router.push('/settings/payments')} />
        <MenuRow icon="bell" label="Notifications" value={profile.data ? (profile.data.notificationsEnabled ? 'On' : 'Off') : undefined} onPress={() => router.push('/settings/notifications')} />
      </MenuGroup>

      <MenuGroup title="Preferences">
        <MenuRow icon="globe" label="Language & currency" value="English · USD" onPress={() => router.push('/settings/language')} />
        <MenuRow icon="shield-check" label="Privacy & security" onPress={() => router.push('/settings/security')} />
        <MenuRow icon="info" label="Help & support" onPress={() => router.push('/settings/help')} />
      </MenuGroup>

      <Pressable accessibilityRole="button" onPress={() => setConfirm(true)} style={styles.logout}>
        <Txt variant="button" size={16} color="error">
          Log out
        </Txt>
      </Pressable>

      <ConfirmDialog visible={confirm} title="Log out of Velora?" body="Your trips and saved stays stay with your account." confirmLabel="Log out" destructive loading={busy} onConfirm={signOut} onCancel={() => setConfirm(false)} />
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Txt variant="stat">{value}</Txt>
      <Txt variant="body" color="text2">
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.ink, borderRadius: 40, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.lime, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 26, paddingVertical: 14, alignItems: 'center', gap: 2 },
  logout: { height: 56, borderRadius: 999, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
