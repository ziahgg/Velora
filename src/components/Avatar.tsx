import { View } from 'react-native';

import { initials } from '@/lib/format';
import { colors } from '@/theme/tokens';
import { Txt } from './Text';

/** Initials avatar (the app doesn't collect profile photos). */
export function Avatar({ name, size = 44, dark }: { name: string; size?: number; dark?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={name}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: dark ? colors.ink2 : colors.lime, alignItems: 'center', justifyContent: 'center' }}
    >
      <Txt variant="label" weight="bold" size={Math.round(size * 0.36)} color={dark ? 'lime' : 'ink'}>
        {initials(name)}
      </Txt>
    </View>
  );
}
