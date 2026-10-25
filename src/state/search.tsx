import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { addDays, isISODate, todayISO } from '@/lib/dates';
import { validateStay, type StayInput } from '@/lib/pricing';
import { EMPTY_FILTERS, type Filters, type Place } from '@/lib/search';

/**
 * Search criteria shared by Home, Search, Results, Hotel Detail and the booking
 * flow. Persisted so the trip survives a restart. Contains no personal data.
 */
export type Category = 'hotels' | 'flights' | 'car';

export interface RecentSearch {
  place: Place;
  label: string;
  stay: StayInput;
  at: string;
}

interface SearchState {
  place: Place;
  /** Display label for the place, e.g. "Bali, Indonesia". */
  placeLabel: string;
  stay: StayInput;
  filters: Filters;
  category: Category;
  recent: RecentSearch[];
  setPlace: (place: Place, label: string) => void;
  setStay: (stay: StayInput) => void;
  setFilters: (filters: Filters) => void;
  setCategory: (c: Category) => void;
  rememberSearch: () => void;
  clearRecent: () => void;
}

const KEY = 'velora.search.v1';
export const ANYWHERE: Place = { destinationId: null, area: null, query: '' };

/** Default trip: four nights, 2 adults + 1 child, starting 18 days out (as in the design). */
export function defaultStay(today = todayISO()): StayInput {
  const checkIn = addDays(today, 18);
  return { checkIn, checkOut: addDays(checkIn, 4), adults: 2, children: 1, rooms: 1 };
}

const SearchContext = createContext<SearchState | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [place, setPlaceState] = useState<Place>({ destinationId: 'bali', area: null, query: '' });
  const [placeLabel, setPlaceLabel] = useState('Bali, Indonesia');
  const [stay, setStayState] = useState<StayInput>(() => defaultStay());
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [category, setCategory] = useState<Category>('hotels');
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<{ place: Place; placeLabel: string; stay: StayInput; recent: RecentSearch[] }>;
        if (saved.place && typeof saved.placeLabel === 'string') {
          setPlaceState(saved.place);
          setPlaceLabel(saved.placeLabel);
        }
        // Stale or invalid dates (e.g. check-in now in the past) fall back to the default trip.
        if (saved.stay && isISODate(saved.stay.checkIn) && !validateStay(saved.stay, todayISO())) setStayState(saved.stay);
        if (Array.isArray(saved.recent)) setRecent(saved.recent.slice(0, 5));
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) void AsyncStorage.setItem(KEY, JSON.stringify({ place, placeLabel, stay, recent })).catch(() => undefined);
  }, [loaded, place, placeLabel, stay, recent]);

  const setPlace = useCallback((p: Place, label: string) => {
    setPlaceState(p);
    setPlaceLabel(label);
  }, []);

  const setStay = useCallback((s: StayInput) => setStayState(s), []);

  const rememberSearch = useCallback(() => {
    if (!place.destinationId && !place.area && !place.query) return;
    setRecent((prev) =>
      [{ place, label: placeLabel, stay, at: new Date().toISOString() }, ...prev.filter((r) => r.label !== placeLabel)].slice(0, 5),
    );
  }, [place, placeLabel, stay]);

  const clearRecent = useCallback(() => setRecent([]), []);

  const value = useMemo(
    () => ({ place, placeLabel, stay, filters, category, recent, setPlace, setStay, setFilters, setCategory, rememberSearch, clearRecent }),
    [place, placeLabel, stay, filters, category, recent, setPlace, setStay, rememberSearch, clearRecent],
  );
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchState {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used inside AppProviders');
  return ctx;
}
