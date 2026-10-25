import type { ImageSource } from 'expo-image';

import type { PhotoRef } from './types';

/**
 * Bundled photography. The seed catalog (and the Supabase seed) reference these
 * by key so the hotel flow works offline; any other value is treated as a URL.
 * Sources: the Velora Figma file's own photos and Unsplash (Unsplash License).
 */
export const bundledPhotos = {
  'dest-bali': require('@/assets/photos/dest-bali.jpg'),
  'dest-maldives': require('@/assets/photos/dest-maldives.jpg'),
  'dest-santorini': require('@/assets/photos/dest-santorini.jpg'),
  'dest-rome': require('@/assets/photos/dest-rome.jpg'),
  'onboarding-oia': require('@/assets/photos/onboarding-oia.jpg'),
  'hotel-grand-horizon': require('@/assets/photos/hotel-grand-horizon.jpg'),
  'hotel-azure-lagoon': require('@/assets/photos/hotel-azure-lagoon.jpg'),
  'hotel-caldera-cliff': require('@/assets/photos/hotel-caldera-cliff.jpg'),
  'hotel-palm-courtyard': require('@/assets/photos/hotel-palm-courtyard.jpg'),
  'hotel-jungle-mist': require('@/assets/photos/hotel-jungle-mist.jpg'),
  'hotel-lagoon-bay': require('@/assets/photos/hotel-lagoon-bay.jpg'),
  'hotel-sidemen-valley': require('@/assets/photos/hotel-sidemen-valley.jpg'),
  'hotel-coral-reef': require('@/assets/photos/hotel-coral-reef.jpg'),
  'hotel-kata-palm': require('@/assets/photos/hotel-kata-palm.jpg'),
  'hotel-palazzo-aurelia': require('@/assets/photos/hotel-palazzo-aurelia.jpg'),
  'hotel-reflection-pool': require('@/assets/photos/hotel-reflection-pool.jpg'),
  'hotel-teak-deck': require('@/assets/photos/hotel-teak-deck.jpg'),
  'room-ocean-view-pool-villa': require('@/assets/photos/room-ocean-view-pool-villa.jpg'),
  'room-cliff-suite': require('@/assets/photos/room-cliff-suite.jpg'),
  'room-family-villa': require('@/assets/photos/room-family-villa.jpg'),
  'room-deluxe-king': require('@/assets/photos/room-deluxe-king.jpg'),
  'room-modern-queen': require('@/assets/photos/room-modern-queen.jpg'),
} as const;

export type BundledPhotoKey = keyof typeof bundledPhotos;

export function photoSource(ref: PhotoRef | undefined): ImageSource | number | null {
  if (!ref) return null;
  if (ref in bundledPhotos) return bundledPhotos[ref as BundledPhotoKey];
  if (/^https?:\/\//.test(ref)) return { uri: ref };
  return null;
}
