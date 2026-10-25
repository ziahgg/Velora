import { useToast } from '@/components/Feedback';
import { errorMessage } from '@/state/session';
import { useFavorites, useSetFavorite } from '@/state/queries';

/** One heart behaviour everywhere: optimistic toggle, "Added to Saved stays · Undo" toast, rollback on error. */
export function useFavoriteToggle(opts: { aboveNav?: boolean } = {}) {
  const { ids } = useFavorites();
  const set = useSetFavorite();
  const toast = useToast();

  const write = (hotelId: string, saved: boolean, withUndo: boolean) =>
    set.mutate(
      { hotelId, saved },
      {
        onSuccess: () => {
          if (!withUndo) return;
          toast(saved ? 'Added to Saved stays' : 'Removed from Saved stays', {
            aboveNav: opts.aboveNav,
            action: { label: 'Undo', onPress: () => write(hotelId, !saved, false) },
          });
        },
        onError: (e) => toast(errorMessage(e), { kind: 'error', aboveNav: opts.aboveNav }),
      },
    );

  return {
    isSaved: (hotelId: string) => ids.has(hotelId),
    toggle: (hotelId: string) => write(hotelId, !ids.has(hotelId), true),
  };
}
