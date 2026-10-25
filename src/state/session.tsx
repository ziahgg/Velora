import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, AppError, type SessionUser } from '@/data';
import { SearchProvider } from './search';

const ONBOARDED_KEY = 'velora.onboarded.v1';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (count, error) => count < 2 && !(error instanceof AppError && ['auth', 'not_found', 'forbidden'].includes(error.code)),
    },
  },
});

interface SessionState {
  user: SessionUser | null;
  ready: boolean;
  onboarded: boolean;
  completeOnboarding: () => void;
  replayOnboarding: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getSession().catch(() => null), AsyncStorage.getItem(ONBOARDED_KEY).catch(() => null)]).then(([u, flag]) => {
      if (!alive) return;
      setUser(u);
      setOnboarded(flag === '1');
      setReady(true);
    });
    const off = api.onAuthChange((u) => {
      setUser((prev) => {
        // A different (or no) user: drop every cached private query.
        if (prev?.id !== u?.id) queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'catalog' });
        return u;
      });
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const completeOnboarding = useCallback(() => {
    setOnboarded(true);
    void AsyncStorage.setItem(ONBOARDED_KEY, '1');
  }, []);
  const replayOnboarding = useCallback(() => {
    setOnboarded(false);
    void AsyncStorage.removeItem(ONBOARDED_KEY);
  }, []);

  const value = useMemo(() => ({ user, ready, onboarded, completeOnboarding, replayOnboarding }), [user, ready, onboarded, completeOnboarding, replayOnboarding]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside AppProviders');
  return ctx;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <SearchProvider>{children}</SearchProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

/** Human message for any thrown value — never echoes raw server errors or tokens. */
export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return 'Something went wrong. Please try again.';
}
