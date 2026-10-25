import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Wordmark } from '@/components/Brand';
import { Button, TextLink } from '@/components/Button';
import { EmptyState } from '@/components/Feedback';
import { Checkbox, TextField } from '@/components/Fields';
import { Screen } from '@/components/Layout';
import { Txt } from '@/components/Text';
import { api } from '@/data';
import { fieldErrors, signUpSchema } from '@/lib/validation';
import { errorMessage } from '@/state/session';

/** Figma 13 Create Account. */
export default function SignUp() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const submit = async () => {
    const e = fieldErrors(signUpSchema, { fullName, email, password, acceptTerms: accept });
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const res = await api.signUp({ fullName, email, password });
      if (res.needsEmailConfirmation) setCheckEmail(true);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (checkEmail) {
    return (
      <Screen contentStyle={{ paddingTop: 120 }}>
        <EmptyState icon="mail" title="Check your inbox" body={`We sent a confirmation link to ${email.trim()}. Open it on this device, then sign in.`} action={{ label: 'Back to sign in', onPress: () => router.replace('/sign-in') }} />
      </Screen>
    );
  }

  return (
    <Screen gap={18} contentStyle={{ paddingTop: 64 }}>
      <Wordmark />
      <View style={{ gap: 6, marginTop: 26 }}>
        <Txt variant="display" accessibilityRole="header">
          Create your account
        </Txt>
        <Txt variant="body" color="text2">
          Save stays, book faster and keep every trip in one place.
        </Txt>
      </View>
      <View style={{ gap: 14 }}>
        <TextField label="Full name" icon="user" tone="white" value={fullName} onChangeText={setFullName} error={errors.fullName} autoComplete="name" textContentType="name" placeholder="Your name" />
        <TextField label="Email" icon="mail" tone="white" value={email} onChangeText={setEmail} error={errors.email} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="name@domain.com" />
        <TextField
          label="Password"
          icon="lock"
          tone="white"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          helper="At least 8 characters with a number"
          secureToggle
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="Create a password"
        />
        <Checkbox checked={accept} onChange={setAccept}>
          <Txt variant="caption" color={errors.acceptTerms ? 'error' : 'text2'}>
            I agree to Velora’s Terms of Service and Privacy Policy
          </Txt>
        </Checkbox>
      </View>
      {formError ? (
        <Txt variant="caption" color="error" accessibilityLiveRegion="polite">
          {formError}
        </Txt>
      ) : null}
      <Button label="Create account" onPress={submit} loading={busy} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <Txt variant="body" color="text2">
          Already have an account?
        </Txt>
        <TextLink label="Sign in" onPress={() => router.replace('/sign-in')} />
      </View>
    </Screen>
  );
}
