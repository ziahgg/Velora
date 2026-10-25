import { useEffect, useState } from 'react';

import { holdSecondsLeft } from '@/lib/booking';

/** Seconds left on a booking hold, ticking once a second. */
export function useHoldCountdown(holdExpiresAt: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!holdExpiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [holdExpiresAt]);
  return holdSecondsLeft(holdExpiresAt ?? null, new Date(now));
}
