import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorState, FullScreenLoader, useToast } from '@/components/Feedback';
import { TextField } from '@/components/Fields';
import { AppBar, Card, Screen } from '@/components/Layout';
import type { Profile } from '@/data/types';
import { fieldErrors, profileSchema } from '@/lib/validation';
import { useProfile, useUpdateProfile } from '@/state/queries';
import { errorMessage } from '@/state/session';

export default function PersonalInformation() {
  const profile = useProfile();
  if (profile.isPending) return <FullScreenLoader />;
  if (profile.isError)
    return (
      <Screen>
        <AppBar title="Personal information" />
        <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
      </Screen>
    );
  return <Form profile={profile.data} />;
}

function Form({ profile }: { profile: Profile }) {
  const router = useRouter();
  const toast = useToast();
  const update = useUpdateProfile();
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const save = () => {
    const e = fieldErrors(profileSchema, { fullName, phone });
    setErrors(e);
    if (Object.keys(e).length) return;
    update.mutate(
      { fullName, phone },
      {
        onSuccess: () => {
          toast('Profile updated');
          router.back();
        },
        onError: (err) => setErrors({ fullName: errorMessage(err) }),
      },
    );
  };

  return (
    <Screen gap={16} footer={<Button label="Save changes" onPress={save} loading={update.isPending} />}>
      <AppBar title="Personal information" />
      <Card radius={30} style={{ gap: 14 }}>
        <TextField label="Full name" icon="user" value={fullName} onChangeText={setFullName} error={errors.fullName} autoComplete="name" />
        <TextField label="Phone" icon="phone" value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" placeholder="+62 812 3456 7890" helper="Used to prefill your bookings." />
        <View pointerEvents="none" style={{ opacity: 0.6 }}>
          <TextField label="Email" icon="mail" value={profile.email} editable={false} helper="Your sign-in email can’t be changed here." />
        </View>
      </Card>
    </Screen>
  );
}
