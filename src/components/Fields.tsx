import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

/**
 * Figma "Form/Input Field": label 12 Medium, 50 px input, radius 16.
 * `tone="grey"` sits on white cards, `tone="white"` on the grey canvas.
 * States: default, focused (ink border), error (red border + tint + message).
 */
export function TextField({
  label,
  icon,
  error,
  helper,
  tone = 'grey',
  secureToggle,
  multiline,
  secureTextEntry,
  ...input
}: TextInputProps & { label: string; icon?: IconName; error?: string; helper?: string; tone?: 'grey' | 'white'; secureToggle?: boolean }) {
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(true);
    const bg = error ? colors.error50 : tone === 'grey' ? colors.bg : colors.surface;
    const border = error ? colors.error : focused ? colors.ink : 'transparent';
    return (
      <View style={{ gap: 6 }}>
        <Txt variant="captionMedium" color="text2">
          {label}
        </Txt>
        <View style={[styles.field, multiline ? styles.multiline : null, { backgroundColor: bg, borderColor: border }]}>
          {icon ? <Icon name={icon} size={18} color="text2" /> : null}
          <TextInput
            {...input}
            multiline={multiline}
            secureTextEntry={secureToggle ? hidden : secureTextEntry}
            accessibilityLabel={label}
            accessibilityHint={error}
            placeholderTextColor={colors.text3}
            onFocus={(e) => {
              setFocused(true);
              input.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              input.onBlur?.(e);
            }}
            style={[styles.input, multiline ? { minHeight: 64, textAlignVertical: 'top', paddingTop: 0 } : null]}
          />
          {secureToggle ? (
            <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'} onPress={() => setHidden((h) => !h)} hitSlop={10}>
              <Icon name={hidden ? 'eye' : 'eye-off'} size={18} color="text2" />
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <Txt variant="caption" color="error" accessibilityLiveRegion="polite">
            {error}
          </Txt>
        ) : helper ? (
          <Txt variant="caption" color="text2">
            {helper}
          </Txt>
        ) : null}
      </View>
    );
}

/** Search field: grey pill (inside the search hero) or outlined white (Search screen). */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  look = 'grey',
  onSubmit,
  autoFocus,
  onPress,
}: {
  value: string;
  onChangeText?: (v: string) => void;
  placeholder: string;
  look?: 'grey' | 'outlined';
  onSubmit?: () => void;
  autoFocus?: boolean;
  /** When set the field is a button that opens Search instead of an input. */
  onPress?: () => void;
}) {
  const outlined = look === 'outlined';
  const box = [styles.search, outlined ? styles.searchOutlined : null];
  if (onPress) {
    return (
      <Pressable accessibilityRole="search" accessibilityLabel={placeholder} onPress={onPress} style={box}>
        <Icon name="search" size={18} color="text2" />
        <Txt variant="body" color="text2" numberOfLines={1} style={{ flex: 1 }}>
          {value || placeholder}
        </Txt>
      </Pressable>
    );
  }
  return (
    <View style={box}>
      <Icon name="search" size={outlined ? 20 : 18} color={outlined ? 'text' : 'text2'} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text2}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        autoCorrect={false}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmit}
        style={[styles.input, outlined ? { fontSize: 16 } : null]}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChangeText?.('')} hitSlop={10}>
          <Icon name="x" size={18} color="text2" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Round −/+ stepper used for adults, children and rooms. */
export function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  return (
    <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Fewer ${label.toLowerCase()}`}
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
        style={[styles.stepBtn, { backgroundColor: colors.surface, opacity: value <= min ? 0.4 : 1 }]}
      >
        <Icon name="minus" size={18} />
      </Pressable>
      <Txt variant="subheading" style={{ minWidth: 22, textAlign: 'center' }}>
        {value}
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More ${label.toLowerCase()}`}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={[styles.stepBtn, { backgroundColor: colors.ink, opacity: value >= max ? 0.4 : 1 }]}
      >
        <Icon name="plus" size={18} color="onInk" />
      </Pressable>
    </View>
  );
}

/** Figma payment radio: outlined circle, or ink circle with a check. */
export function Radio({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.radio, selected ? { backgroundColor: colors.ink, borderColor: colors.ink } : null]}>
      {selected ? <Icon name="check" size={14} color="onInk" strokeWidth={3} /> : null}
    </View>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={styles.check} hitSlop={6}>
      <View style={[styles.checkBox, checked ? { backgroundColor: colors.ink, borderColor: colors.ink } : null]}>{checked ? <Icon name="check" size={13} color="lime" strokeWidth={3} /> : null}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: 50, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  multiline: { alignItems: 'flex-start', paddingVertical: 14 },
  input: { ...type.bodyMedium, color: colors.text, flex: 1, paddingVertical: 0, minHeight: 20 },
  search: { height: 48, borderRadius: 999, backgroundColor: colors.chip, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  searchOutlined: { height: 52, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.ink, paddingHorizontal: 18 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.text3, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  check: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  checkBox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.text3, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, marginTop: 1 },
});
