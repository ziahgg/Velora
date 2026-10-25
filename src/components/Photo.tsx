import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { photoSource } from '@/data/photos';
import { colors } from '@/theme/tokens';
import { Icon } from './Icon';

/**
 * Cropped photo with a neutral fallback: if a photo can't load (missing key,
 * offline remote URL) the layout keeps its size and shows a quiet placeholder.
 */
export function Photo({
  photo,
  style,
  radius = 0,
  label,
  children,
  contentPosition = 'center',
}: {
  photo?: string;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  label?: string;
  children?: React.ReactNode;
  contentPosition?: 'center' | 'top' | 'bottom';
}) {
  const [failed, setFailed] = useState(false);
  const source = photoSource(photo);
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor: colors.chip }, style]} accessible={!!label} accessibilityRole={label ? 'image' : undefined} accessibilityLabel={label}>
      {source && !failed ? (
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={contentPosition} transition={150} onError={() => setFailed(true)} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback]}>
          <Icon name="hotel" size={28} color="text3" />
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
