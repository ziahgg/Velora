import { useSyncExternalStore } from 'react';

/**
 * Height of the currently mounted fixed "Footer actions" panel, so toasts can
 * float above it (as in the Figma confirmation screens) instead of covering it.
 */
let footerHeight = 0;
const listeners = new Set<() => void>();

export function setFooterHeight(h: number) {
  if (h === footerHeight) return;
  footerHeight = h;
  listeners.forEach((l) => l());
}

export function useFooterHeight(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => footerHeight,
    () => 0,
  );
}
