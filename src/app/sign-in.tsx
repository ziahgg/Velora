import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/Brand';
import { Button, TextLink } from '@/components/Button';
import { DevNote, useToast } from '@/components/Feedback';
import { TextField } from '@/components/Fields';
import { Screen } from '@/components/Layout';
import { Txt } from '@/components/Text';
import { api } from '@/data';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/data/local/db';
import { fieldErrors, signInSchema } from '@/lib/validation';
import { errorMessage, useSession } from '@/state/session';
import { colors } from '@/theme/tokens';

/** Figma 12 Sign In. */
export default function SignIn() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { onboarded } = useSession();

  const submit = async () => {
    const e = fieldErrors(signInSchema, { email, password });
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.signIn(email, password);
      // The root gate swaps to the app once the session changes.
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // First launch: show the intro before sign-in.
  if (!onboarded) return <Redirect href="/onboarding" />;

  const social = (name: string) => toast(`${name} sign-in isn’t set up yet — use email for now.`, { kind: 'error' });

  return (
    <Screen gap={18} contentStyle={{ paddingTop: 64 }}>
      <Wordmark />
      <View style={{ gap: 6, marginTop: 26 }}>
        <Txt variant="display" accessibilityRole="header">
          Welcome back
        </Txt>
        <Txt variant="body" color="text2">
          Sign in to manage your trips and saved stays.
        </Txt>
      </View>

      {api.mode === 'demo' ? (
        <Pressable accessibilityRole="button" onPress={() => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); }}>
          <DevNote text={`Demo mode — data stays on this device. Tap to fill the demo account (${DEMO_EMAIL} / ${DEMO_PASSWORD}).`} />
        </Pressable>
      ) : null}

      <View style={{ gap: 14 }}>
        <TextField label="Email" icon="mail" tone="white" value={email} onChangeText={setEmail} error={errors.email} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="name@domain.com" />
        <TextField label="Password" icon="lock" tone="white" value={password} onChangeText={setPassword} error={errors.password} secureToggle autoComplete="current-password" textContentType="password" placeholder="Your password" onSubmitEditing={submit} />
        <TextLink label="Forgot password?" onPress={() => router.push('/forgot-password')} />
      </View>

      {formError ? (
        <Txt variant="caption" color="error" accessibilityLiveRegion="polite">
          {formError}
        </Txt>
      ) : null}
      <Button label="Sign in" onPress={submit} loading={busy} />

      <View style={styles.divider}>
        <View style={styles.line} />
        <Txt variant="caption" color="text2">
          or continue with
        </Txt>
        <View style={styles.line} />
      </View>
      <View style={styles.social}>
        <Pressable accessibilityRole="button" onPress={() => social('Google')} style={styles.socialBtn}>
          <Txt variant="heading" style={{ color: '#4285F5' }}>
            G
          </Txt>
          <Txt variant="label" numberOfLines={1}>
            Continue with Google
          </Txt>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => social('Apple')} style={styles.socialBtn}>
          <Txt variant="label" numberOfLines={1}>
            Continue with Apple
          </Txt>
        </Pressable>
      </View>
      <View style={styles.foot}>
        <Txt variant="body" color="text2">
          New to Velora?
        </Txt>
        <TextLink label="Create account" onPress={() => router.push('/sign-up')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  social: { flexDirection: 'row', gap: 10 },
  socialBtn: { flex: 1, height: 52, borderRadius: 999, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  foot: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
});
