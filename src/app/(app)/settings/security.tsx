import { useState } from 'react';

import { Button } from '@/components/Button';
import { DevNote, useToast } from '@/components/Feedback';
import { TextField } from '@/components/Fields';
import { AppBar, Card, Screen } from '@/components/Layout';
import { MenuGroup, MenuRow } from '@/components/MenuRow';
import { Txt } from '@/components/Text';
import { api } from '@/data';
import { fieldErrors, newPasswordSchema } from '@/lib/validation';
import { errorMessage, useSession } from '@/state/session';

export default function PrivacySecurity() {
  const toast = useToast();
  const { replayOnboarding } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [busy, setBusy] = useState(false);

  const change = async () => {
    const e = fieldErrors(newPasswordSchema, { password, confirm });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.updatePassword(password);
      setPassword('');
      setConfirm('');
      toast('Password updated');
    } catch (err) {
      setErrors({ password: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen gap={16}>
      <AppBar title="Privacy & security" />
      <Txt variant="subheading">Change password</Txt>
      <Card radius={30} style={{ gap: 14 }}>
        <TextField label="New password" icon="lock" value={password} onChangeText={setPassword} error={errors.password} secureToggle autoComplete="new-password" helper="At least 8 characters with a number" />
        <TextField label="Confirm password" icon="lock" value={confirm} onChangeText={setConfirm} error={errors.confirm} secureToggle autoComplete="new-password" />
        <Button label="Update password" onPress={change} loading={busy} size="medium" />
      </Card>
      <MenuGroup title="App">
        <MenuRow icon="sparkles" label="Show the intro again" onPress={() => { replayOnboarding(); toast('The intro will show next time you sign out.'); }} />
      </MenuGroup>
      <DevNote
        icon="shield-check"
        text={
          api.mode === 'demo'
            ? 'Demo mode: your account, bookings and saved stays are stored only on this device. Signing out keeps them here.'
            : 'Your bookings, payments and saved stays are private to your account (row-level security). Card details are never stored.'
        }
      />
    </Screen>
  );
}
