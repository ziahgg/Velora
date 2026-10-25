import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, type ColorToken } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

type Variant = 'primary' | 'secondary' | 'tonal' | 'lime' | 'dashed';

const V: Record<Variant, { bg: ColorToken; fg: ColorToken; border?: ColorToken }> = {
  primary: { bg: 'ink', fg: 'onInk' },
  secondary: { bg: 'surface', fg: 'text' },
  tonal: { bg: 'chip', fg: 'text' },
  lime: { bg: 'lime', fg: 'ink' },
  dashed: { bg: 'chip', fg: 'text', border: 'text3' },
};

/** Figma "Button": pill, Large 56 px / Medium 44 px, variants Primary · Secondary · Tonal · Lime · Dashed · Disabled. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  icon,
  disabled,
  loading,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'large' | 'medium';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const v = V[variant];
  const inactive = disabled || loading;
  const bg = disabled ? colors.chip : colors[v.bg];
  const fg: ColorToken = disabled ? 'text3' : v.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'large' ? styles.large : styles.medium,
        { backgroundColor: bg },
        v.border && !disabled ? { borderWidth: 1.2, borderColor: colors[v.border], borderStyle: 'dashed' } : null,
        pressed && !inactive ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[fg]} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <Txt variant="button" color={fg} size={size === 'medium' ? 14 : undefined} numberOfLines={1}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

type IconStyle = 'white' | 'grey' | 'ink' | 'lime' | 'glass';
const IB: Record<IconStyle, { bg: string; fg: ColorToken }> = {
  white: { bg: colors.surface, fg: 'text' },
  grey: { bg: colors.chip, fg: 'text' },
  ink: { bg: colors.ink, fg: 'onInk' },
  lime: { bg: colors.lime, fg: 'ink' },
  glass: { bg: 'rgba(255,255,255,0.92)', fg: 'text' },
};

/** Figma "Icon Button": 44 px circle, styles White · Grey · Ink · Lime · Glass. */
export function IconButton({
  icon,
  onPress,
  label,
  look = 'white',
  size = 44,
  iconSize = 20,
  iconColor,
  iconFill,
  badge,
  disabled,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  look?: IconStyle;
  size?: number;
  iconSize?: number;
  iconColor?: ColorToken;
  iconFill?: ColorToken;
  badge?: boolean;
  disabled?: boolean;
}) {
  const s = IB[look];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={Math.max(0, (48 - size) / 2)}
      onPress={onPress}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center' },
        pressed ? { opacity: 0.75 } : null,
        disabled ? { opacity: 0.4 } : null,
      ]}
    >
      <Icon name={icon} size={iconSize} color={iconColor ?? s.fg} fill={iconFill} />
      {badge ? <View style={styles.badge} /> : null}
    </Pressable>
  );
}

/** "View all ›" link with the grey dot chevron from the section headers. */
export function ViewAll({ label = 'View all', onPress }: { label?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} style={styles.viewAll}>
      <Txt variant="bodyMedium" color="text2">
        {label}
      </Txt>
      <View style={styles.dot}>
        <Icon name="chevron-right" size={12} color="onInk" strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

export function TextLink({ label, onPress, color = 'text' }: { label: string; onPress: () => void; color?: ColorToken }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <Txt variant="label" color={color}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function PressableCard({ children, onPress, style, label }: { children: ReactNode; onPress: () => void; style?: StyleProp<ViewStyle>; label?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [style, pressed ? { opacity: 0.92 } : null]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  large: { height: 56, paddingHorizontal: 28 },
  medium: { height: 44, paddingHorizontal: 20 },
  badge: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.text2, alignItems: 'center', justifyContent: 'center' },
});
