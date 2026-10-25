import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadows, SIDE } from '@/theme/tokens';
import { Button, IconButton } from './Button';
import { Icon, type IconName } from './Icon';
import { NAV_SPACE } from './Layout';
import { useFooterHeight } from './overlayInsets';
import { Txt } from './Text';

/* ───────────────────────────── Toast ───────────────────────────── */

interface ToastOptions {
  kind?: 'success' | 'error';
  action?: { label: string; onPress: () => void };
  aboveNav?: boolean;
}
interface ToastState extends ToastOptions {
  id: number;
  message: string;
}

const ToastContext = createContext<(message: string, opts?: ToastOptions) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

/** Figma "Feedback/Toast": ink pill, lime check icon, white label, lime action. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const insets = useSafeAreaInsets();
  const footer = useFooterHeight();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, opts: ToastOptions = {}) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: Date.now(), message, kind: 'success', ...opts });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(
        () => Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setToast(null)),
        opts.action ? 5000 : 3000,
      );
    },
    [opacity],
  );

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const bottom = footer ? footer + 12 : (toast?.aboveNav ? NAV_SPACE : 24) + insets.bottom;
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View pointerEvents="box-none" style={[styles.toastWrap, { opacity, bottom }]}>
          <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Icon name={toast.kind === 'error' ? 'circle-alert' : 'circle-check'} size={18} color={toast.kind === 'error' ? 'error' : 'lime'} />
            <Txt variant="label" color="onInk" style={{ flex: 1 }}>
              {toast.message}
            </Txt>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  toast.action?.onPress();
                  setToast(null);
                }}
                hitSlop={10}
              >
                <Txt variant="label" color="lime">
                  {toast.action.label}
                </Txt>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

/* ───────────────────────────── State hero ───────────────────────────── */

/** White ring + ink disc + lime icon + lime dot — the empty / offline / failed states in Figma. */
export function StateHero({ icon, tone = 'ink' }: { icon: IconName; tone?: 'ink' | 'error' | 'success' }) {
  if (tone === 'success') {
    return (
      <View style={[styles.ring, { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.lime }]}>
        <View style={[styles.disc, { width: 68, height: 68, borderRadius: 34 }]}>
          <Icon name={icon} size={26} color="lime" strokeWidth={2.5} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.ring}>
      <View style={[styles.disc, tone === 'error' ? { backgroundColor: colors.error } : null]}>
        <Icon name={icon} size={28} color={tone === 'error' ? 'onInk' : 'lime'} />
      </View>
      <View style={styles.dot} />
    </View>
  );
}

export function EmptyState({ icon, title, body, action, secondary }: { icon: IconName; title: string; body: string; action?: { label: string; onPress: () => void }; secondary?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.empty}>
      <StateHero icon={icon} />
      <Txt variant="heading" align="center" style={{ marginTop: 8 }}>
        {title}
      </Txt>
      <Txt variant="body" color="text2" align="center" style={{ maxWidth: 300 }}>
        {body}
      </Txt>
      {action ? <Button label={action.label} onPress={action.onPress} style={{ marginTop: 8, alignSelf: 'center' }} /> : null}
      {secondary ? <Button label={secondary.label} variant="tonal" onPress={secondary.onPress} style={{ alignSelf: 'center' }} /> : null}
    </View>
  );
}

/** Offline / load error with retry (Figma S6). */
export function ErrorState({ message, onRetry, offline, secondary }: { message: string; onRetry: () => void; offline?: boolean; secondary?: { label: string; onPress: () => void } }) {
  return (
    <EmptyState
      icon={offline ? 'wifi-off' : 'circle-alert'}
      title={offline ? 'You’re offline' : 'Couldn’t load this'}
      body={message}
      action={{ label: 'Try again', onPress: onRetry }}
      secondary={secondary}
    />
  );
}

/* ───────────────────────────── Skeleton ───────────────────────────── */

export function Skeleton({ width, height, radius = 12 }: { width: number | `${number}%`; height: number; radius?: number }) {
  const [pulse] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={{ width, height, borderRadius: radius, backgroundColor: colors.chip, opacity: pulse }} />;
}

/** Loading card from Figma S4: photo block + three text bars. */
export function SkeletonCard() {
  return (
    <View style={styles.skeletonCard} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <Skeleton width="100%" height={190} radius={22} />
      <View style={{ gap: 12, paddingHorizontal: 0, paddingTop: 12, paddingBottom: 8 }}>
        <Skeleton width={120} height={12} radius={6} />
        <Skeleton width={220} height={12} radius={6} />
        <Skeleton width={160} height={12} radius={6} />
      </View>
    </View>
  );
}

export function FullScreenLoader() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.ink} />
    </View>
  );
}

/* ───────────────────────────── Sheet & dialog ───────────────────────────── */

/** Bottom sheet from the Dates & guests / Filters frames: dimmed backdrop, handle, title, close. */
export function Sheet({
  visible,
  onClose,
  title,
  right,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: height - insets.top - 40, paddingBottom: Math.max(insets.bottom, 12) + 8 }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Txt variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
              {title}
            </Txt>
            {right ?? <IconButton icon="x" label="Close" look="grey" onPress={onClose} />}
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: SIDE, gap: 22, paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: SIDE, paddingTop: 8 }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

/** Confirmation dialog for destructive actions (cancel booking, sign out). */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
  destructive,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  destructive?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.scrimCenter}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Txt variant="heading">{title}</Txt>
          <Txt variant="body" color="text2">
            {body}
          </Txt>
          <View style={{ gap: 10, marginTop: 8 }}>
            <Button label={confirmLabel} onPress={onConfirm} loading={loading} style={destructive ? { backgroundColor: colors.error } : undefined} />
            <Button label="Keep it" variant="tonal" onPress={onCancel} disabled={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Small banner that marks development-only behaviour (sample data, sandbox payments). */
export function DevNote({ text, icon = 'info' }: { text: string; icon?: IconName }) {
  return (
    <View style={styles.devNote} accessibilityRole="text">
      <Icon name={icon} size={16} color="text2" />
      <Txt variant="caption" color="text2" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: SIDE, right: SIDE },
  toast: { minHeight: 42, borderRadius: 999, backgroundColor: colors.ink, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, ...shadows.nav },
  ring: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  disc: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 10, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.lime },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 12 },
  skeletonCard: { backgroundColor: colors.surface, borderRadius: 30, padding: 8 },
  scrim: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  scrimCenter: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: SIDE },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginTop: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SIDE, paddingTop: 16, paddingBottom: 14 },
  dialog: { backgroundColor: colors.surface, borderRadius: 28, padding: 24, gap: 8 },
  devNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 16, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
});
