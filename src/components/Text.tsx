import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { colors, type ColorToken } from '@/theme/tokens';
import { fonts, type, type FontWeight, type TypeVariant } from '@/theme/typography';

export interface TxtProps extends TextProps {
  variant?: TypeVariant;
  color?: ColorToken;
  align?: TextStyle['textAlign'];
  weight?: FontWeight;
  size?: number;
}

/** Text bound to the Velora type scale and colour tokens. Scales with the system font size, capped to keep layouts intact. */
export function Txt({ variant = 'body', color = 'text', align, weight, size, style, maxFontSizeMultiplier = 1.4, ...rest }: TxtProps) {
  const base = type[variant];
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        base,
        { color: colors[color] },
        align ? { textAlign: align } : null,
        weight ? { fontFamily: fonts[weight] } : null,
        size ? { fontSize: size, lineHeight: Math.round(size * (base.lineHeight / base.fontSize)) } : null,
        style,
      ]}
    />
  );
}
