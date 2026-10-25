import type { TextStyle } from 'react-native';

/** Plus Jakarta Sans weights registered in the root layout (expo-google-fonts, OFL). */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type FontWeight = keyof typeof fonts;

/** Letter spacing in Figma is a % of the font size; React Native wants points. */
const ls = (size: number, percent: number) => +(size * (percent / 100)).toFixed(2);

/**
 * The "Velora/*" text styles from Figma, plus the few one-off sizes the frames
 * use repeatedly (card titles, stat numbers, amount due).
 */
export const type = {
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: ls(30, -2) },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: ls(24, -1.5) },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: ls(20, -1) },
  subheading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: ls(17, -0.5) },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 23, letterSpacing: ls(18, -0.5) },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 18 },
  price: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, letterSpacing: ls(26, -2) },
  amountDue: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 46, letterSpacing: ls(40, -2) },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  captionMedium: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: ls(11, 4),
    textTransform: 'uppercase',
  },
  stat: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: ls(24, -1.5) },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
