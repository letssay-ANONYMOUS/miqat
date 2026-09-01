import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS, type PrayerKey, type Settings } from './prayer';
import { methodForPlace } from './methods';
import type { Place } from './geo';

interface State {
  place: Place | null;
  settings: Settings;
  /** Set once the user picks a method by hand, so auto-detect stops overriding. */
  methodPinned: boolean;
  /** Whether the board shows the adhan or the congregation (iqama) times. */
  viewMode: 'adhan' | 'iqama';
  setViewMode: (mode: 'adhan' | 'iqama') => void;
  /**
   * Opt-in to sending exact coordinates to the app's owner. Off unless the user
   * turns it on — a pre-ticked box is not consent.
   */
  sharePreciseLocation: boolean;
  setSharePreciseLocation: (share: boolean) => void;
  /** Degrees added to the raw compass to reach true north, set from the sun. */
  qiblaOffset: number;
  setQiblaOffset: (offset: number) => void;
  setPlace: (place: Place) => void;
  patchSettings: (patch: Partial<Settings>) => void;
  setOffset: (key: PrayerKey, minutes: number) => void;
  pinMethod: (pinned: boolean) => void;
  setIqamaOffset: (key: PrayerKey, minutes: number | null) => void;
  resetOffsets: () => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      place: null,
      settings: DEFAULT_SETTINGS,
      methodPinned: false,
      viewMode: 'adhan',
      setViewMode: (viewMode) => set({ viewMode }),
      sharePreciseLocation: false,
      setSharePreciseLocation: (sharePreciseLocation) => set({ sharePreciseLocation }),
      qiblaOffset: 0,
      setQiblaOffset: (qiblaOffset) => set({ qiblaOffset }),
      setPlace: (place) => {
        const { methodPinned, settings } = get();
        set({
          place,
          settings: {
            ...settings,
            elevation: place.elevation,
            method: methodPinned
              ? settings.method
              : methodForPlace(place.countryCode, place.latitude, place.longitude),
          },
        });
      },
      patchSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      setOffset: (key, minutes) =>
        set({
          settings: {
            ...get().settings,
            offsets: { ...get().settings.offsets, [key]: minutes },
          },
        }),
      pinMethod: (methodPinned) => set({ methodPinned }),
      setIqamaOffset: (key, minutes) =>
        set({
          settings: {
            ...get().settings,
            iqamaOffsets: { ...get().settings.iqamaOffsets, [key]: minutes },
          },
        }),
      resetOffsets: () =>
        set({
          settings: {
            ...get().settings,
            offsets: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
          },
        }),
    }),
    {
      name: 'miqat.v1',
      version: 1,
      merge: (persisted, current) => {
        const saved = persisted as Partial<State> | undefined;
        const settings = { ...DEFAULT_SETTINGS, ...(saved?.settings ?? {}) };
        // Re-derive the convention on every load unless the user chose one, so a
        // stored location can never end up paired with a stale global default.
        if (!saved?.methodPinned && saved?.place) {
          settings.method = methodForPlace(
            saved.place.countryCode,
            saved.place.latitude,
            saved.place.longitude,
          );
        }
        return { ...current, ...saved, settings };
      },
    },
  ),
);
