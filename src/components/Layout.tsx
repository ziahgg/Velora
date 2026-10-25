import { useRouter } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, SECTION_GAP, shadows, SIDE } from '@/theme/tokens';
import { IconButton, ViewAll } from './Button';
import type { IconName } from './Icon';
import { setFooterHeight } from './overlayInsets';
import { Txt } from './Text';

/** Room the floating pill navigation takes at the bottom of tab screens. */
export const NAV_SPACE = 60 + 42;

/** Grey canvas with safe-area padding, scrolling content and an optional sticky footer. */
export function Screen({
  children,
  footer,
  withNav,
  scroll = true,
  gap = SECTION_GAP,
  padTop = true,
  onRefresh,
  refreshing = false,
  bg = 'bg',
  contentStyle,
}: {
  children: ReactNode;
  footer?: ReactNode;
  withNav?: boolean;
  scroll?: boolean;
  gap?: number;
  padTop?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  bg?: 'bg' | 'surface';
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const bottom = withNav ? NAV_SPACE + insets.bottom : footer ? 24 : insets.bottom + 24;
  const inner = <View style={[{ gap, paddingHorizontal: SIDE, paddingTop: padTop ? insets.top + 8 : 0, paddingBottom: bottom }, contentStyle]}>{children}</View>;
  return (
    <View style={[styles.root, { backgroundColor: colors[bg] }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} /> : undefined}
          >
            {inner}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{inner}</View>
        )}
        {footer ? <Footer>{footer}</Footer> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Sticky footer with the screen's single primary action (usage rule: "one per screen, usually sticky"). */
export function Footer({ children, row }: { children: ReactNode; row?: boolean }) {
  const insets = useSafeAreaInsets();
  useEffect(() => () => setFooterHeight(0), []);
  return (
    <View
      onLayout={(e) => setFooterHeight(Math.round(e.nativeEvent.layout.height))}
      style={[styles.footer, row ? styles.footerRow : null, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}
    >
      {children}
    </View>
  );
}

/** Back circle, centred 17 px title, optional right action — the Figma app bar. */
export function AppBar({ title, action, onBack, transparent }: { title?: string; action?: { icon: IconName; label: string; onPress: () => void }; onBack?: () => void; transparent?: boolean }) {
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.appBar}>
      <IconButton icon="arrow-left" label="Back" look={transparent ? 'glass' : 'white'} onPress={back} />
      <Txt variant="subheading" align="center" numberOfLines={1} style={{ flex: 1 }} accessibilityRole="header">
        {title ?? ''}
      </Txt>
      {action ? <IconButton icon={action.icon} label={action.label} onPress={action.onPress} /> : <View style={{ width: 44 }} />}
    </View>
  );
}

/** Large page title (My Trips, Saved stays, Profile) with an optional circle action. */
export function PageTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.pageTitle}>
      <Txt variant="display" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </Txt>
      {action}
    </View>
  );
}

export function SectionHeader({ title, onViewAll, linkLabel, size = 'heading' }: { title: string; onViewAll?: () => void; linkLabel?: string; size?: 'heading' | 'subheading' }) {
  return (
    <View style={styles.section}>
      <Txt variant={size} accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </Txt>
      {onViewAll ? <ViewAll label={linkLabel} onPress={onViewAll} /> : null}
    </View>
  );
}

export function Card({ children, style, padding = 16, radius = 24 }: { children: ReactNode; style?: StyleProp<ViewStyle>; padding?: number; radius?: number }) {
  return <View style={[{ backgroundColor: colors.surface, borderRadius: radius, padding }, style]}>{children}</View>;
}

export function Divider({ dashed }: { dashed?: boolean }) {
  return <View style={[styles.divider, dashed ? { borderStyle: 'dashed', borderTopWidth: 1, height: 0, backgroundColor: 'transparent', borderColor: colors.border } : null]} />;
}

/** "Label .......... Value" price/summary row. */
export function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Txt variant={strong ? 'label' : 'body'} color={strong ? 'text' : 'text2'} style={{ flexShrink: 1 }}>
        {label}
      </Txt>
      <Txt variant={strong ? 'heading' : 'label'} color={muted ? 'text2' : 'text'}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  footer: { paddingTop: 12, paddingHorizontal: SIDE, gap: 10, backgroundColor: colors.bg },
  footerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingTop: 14, ...shadows.footer },
  appBar: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  pageTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 26 },
  divider: { height: 1, backgroundColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 30 },
});
