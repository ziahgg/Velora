import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

/** Profile list row: grey icon circle, label, optional value, chevron. */
export function MenuRow({ icon, label, value, onPress }: { icon: IconName; label: string; value?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress} style={({ pressed }) => [styles.row, pressed ? { opacity: 0.6 } : null]}>
      <View style={styles.icon}>
        <Icon name={icon} size={20} />
      </View>
      <Txt variant="rowTitle" size={16} style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Txt>
      {value ? (
        <Txt variant="body" color="text2" numberOfLines={1} style={{ maxWidth: 140 }}>
          {value}
        </Txt>
      ) : null}
      <Icon name="chevron-right" size={18} color="text2" />
    </Pressable>
  );
}

export function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <Txt variant="overline" color="text2">
        {title}
      </Txt>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 30, paddingHorizontal: 14, paddingVertical: 8 },
});
