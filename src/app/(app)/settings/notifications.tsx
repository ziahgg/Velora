import { Pressable, Switch, View } from 'react-native';

import { DevNote, ErrorState, FullScreenLoader, useToast } from '@/components/Feedback';
import { AppBar, Card, Screen } from '@/components/Layout';
import { Txt } from '@/components/Text';
import { useProfile, useUpdateProfile } from '@/state/queries';
import { errorMessage } from '@/state/session';
import { colors } from '@/theme/tokens';

export default function Notifications() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const toast = useToast();
  if (profile.isPending) return <FullScreenLoader />;
  if (profile.isError)
    return (
      <Screen>
        <AppBar title="Notifications" />
        <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
      </Screen>
    );
  const on = profile.data.notificationsEnabled;
  const toggle = (value: boolean) => update.mutate({ notificationsEnabled: value }, { onError: (e) => toast(errorMessage(e), { kind: 'error' }) });
  return (
    <Screen gap={16}>
      <AppBar title="Notifications" />
      <Card radius={24}>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={() => toggle(!on)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="rowTitle">Trip reminders</Txt>
            <Txt variant="caption" color="text2">
              Payment holds and upcoming check-ins in the reminders list on Home.
            </Txt>
          </View>
          <Switch value={on} onValueChange={toggle} trackColor={{ true: colors.ink, false: colors.border }} thumbColor={on ? colors.lime : colors.surface} disabled={update.isPending} />
        </Pressable>
      </Card>
      <DevNote text="Your choice is saved to your profile. Push notifications aren’t connected to a delivery service in this build." />
    </Screen>
  );
}
