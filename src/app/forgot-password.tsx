import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { DevNote, EmptyState } from '@/components/Feedback';
import { TextField } from '@/components/Fields';
import { AppBar, Screen } from '@/components/Layout';
import { Txt } from '@/components/Text';
import { api } from '@/data';
import { fieldErrors, forgotSchema } from '@/lib/validation';
import { errorMessage } from '@/state/session';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const e = fieldErrors(forgotSchema, { email });
    setError(e.email);
    if (e.email) return;
    setBusy(true);
    try {
      await api.sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Screen contentStyle={{ paddingTop: 120 }}>
        <EmptyState
          icon="mail"
          title="Check your email"
          body={`If an account exists for ${email.trim()}, a reset link is on its way. Open it on this device to choose a new password.`}
          action={{ label: 'Back to sign in', onPress: () => router.replace('/sign-in') }}
        />
      </Screen>
    );
  }

  return (
    <Screen gap={18}>
      <AppBar title="Reset password" />
      <View style={{ gap: 6 }}>
        <Txt variant="display" accessibilityRole="header">
          Forgot your password?
        </Txt>
        <Txt variant="body" color="text2">
          Enter the email you signed up with and we’ll send you a link to choose a new one.
        </Txt>
      </View>
      {api.mode === 'demo' ? <DevNote text="Demo mode can’t send email. Reset links work once Supabase is configured." /> : null}
      <TextField label="Email" icon="mail" tone="white" value={email} onChangeText={setEmail} error={error} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="name@domain.com" onSubmitEditing={submit} />
      <Button label="Send reset link" onPress={submit} loading={busy} />
    </Screen>
  );
}
