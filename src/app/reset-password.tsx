import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState, FullScreenLoader, useToast } from '@/components/Feedback';
import { TextField } from '@/components/Fields';
import { Screen } from '@/components/Layout';
import { Txt } from '@/components/Text';
import { api } from '@/data';
import { fieldErrors, newPasswordSchema } from '@/lib/validation';
import { errorMessage } from '@/state/session';

/** Opened from the Supabase password-reset email (velora://reset-password?code=…). */
export default function ResetPassword() {
  const router = useRouter();
  const toast = useToast();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [phase, setPhase] = useState<'checking' | 'ready' | 'invalid'>(code ? 'checking' : 'ready');
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return;
    api
      .exchangeRecoveryCode(code)
      .then(() => setPhase('ready'))
      .catch((e) => {
        setLinkError(errorMessage(e));
        setPhase('invalid');
      });
  }, [code]);

  const submit = async () => {
    const e = fieldErrors(newPasswordSchema, { password, confirm });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.updatePassword(password);
      toast('Password updated');
      router.replace('/');
    } catch (err) {
      setErrors({ password: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'checking') return <FullScreenLoader />;
  if (phase === 'invalid') {
    return (
      <Screen contentStyle={{ paddingTop: 120 }}>
        <EmptyState icon="key" title="Link expired" body={linkError} action={{ label: 'Request a new link', onPress: () => router.replace('/forgot-password') }} />
      </Screen>
    );
  }
  return (
    <Screen gap={18} contentStyle={{ paddingTop: 64 }}>
      <View style={{ gap: 6 }}>
        <Txt variant="display" accessibilityRole="header">
          Choose a new password
        </Txt>
        <Txt variant="body" color="text2">
          At least 8 characters with a number.
        </Txt>
      </View>
      <TextField label="New password" icon="lock" tone="white" value={password} onChangeText={setPassword} error={errors.password} secureToggle autoComplete="new-password" />
      <TextField label="Confirm password" icon="lock" tone="white" value={confirm} onChangeText={setConfirm} error={errors.confirm} secureToggle autoComplete="new-password" onSubmitEditing={submit} />
      <Button label="Update password" onPress={submit} loading={busy} />
    </Screen>
  );
}
