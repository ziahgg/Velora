/**
 * Velora design tokens — copied from the Figma variables (collection "Velora",
 * App Velora page → Foundations). Use these instead of raw values.
 */
export const colors = {
  bg: '#F2F2F2',
  surface: '#FFFFFF',
  surface2: '#F7F7F7',
  chip: '#EFEFEF',
  border: '#E6E6E6',
  ink: '#141414',
  ink2: '#2A2A2A',
  lime: '#E4F74A',
  onInk: '#FFFFFF',
  star: '#F5B400',
  text: '#141414',
  text2: '#6E6E73',
  text3: '#A1A1A6',
  success: '#22A06B',
  success50: '#E8F6EF',
  error: '#E5484D',
  error50: '#FDECEC',
  warning: '#D98E04',
  /** Hotel-detail favourite heart on photos and toasts' success icon reuse ink/lime. */
  heart: '#E5484D',
  overlay: 'rgba(20,20,20,0.45)',
  glass: 'rgba(20,20,20,0.55)',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;

/** radius/sm·md·lg·xl·pill from Foundations, plus the component radii measured in the frames. */
export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
  /** Search panel inside the search hero. */
  panel: 26,
  /** Hotel card outer radius. */
  card: 30,
  /** Stay-row thumbnail. */
  thumb: 18,
} as const;

export const space = { 4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24, 32: 32 } as const;

/** "Screen margin 20 px, card padding 16 px, section gap 22 px." */
export const SIDE = 20;
export const SECTION_GAP = 22;
export const CARD_PAD = 16;

/** Shadows are reserved for the floating nav, sticky footers and toasts. */
export const shadows = {
  nav: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  footer: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  pin: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;
