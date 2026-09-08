import type { Place } from './geo';
import type { Settings } from './prayer';

const COOKIE = 'miqat.preferences';
const YEAR = 60 * 60 * 24 * 365;

type SavedSettings = Pick<
  Settings,
  | 'language'
  | 'method'
  | 'madhab'
  | 'timeFormat'
  | 'clockStyle'
  | 'prayerLayout'
  | 'dialStyle'
  | 'hijriOffset'
  | 'lockScreenMode'
>;

export interface PreferenceCookie {
  settings?: Partial<SavedSettings>;
  viewMode?: 'adhan' | 'iqama';
  /** City/search coordinates only. Exact GPS fixes never enter a cookie. */
  place?: Place;
}

export function writePreferenceCookie(
  place: Place | null,
  settings: Settings,
  viewMode: 'adhan' | 'iqama',
): void {
  if (typeof document === 'undefined') return;
  const safePlace = place && place.source !== 'gps' ? place : undefined;
  const value: PreferenceCookie = {
    place: safePlace,
    viewMode,
    settings: {
      language: settings.language,
      method: settings.method,
      madhab: settings.madhab,
      timeFormat: settings.timeFormat,
      clockStyle: settings.clockStyle,
      prayerLayout: settings.prayerLayout,
      dialStyle: settings.dialStyle,
      hijriOffset: settings.hijriOffset,
      lockScreenMode: settings.lockScreenMode,
    },
  };
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${YEAR}; SameSite=Lax${secure}`;
}

export function readPreferenceCookie(): PreferenceCookie | undefined {
  if (typeof document === 'undefined') return undefined;
  const prefix = `${COOKIE}=`;
  const raw = document.cookie
    .split('; ')
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  if (!raw) return undefined;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as PreferenceCookie;
    return value && typeof value === 'object' ? value : undefined;
  } catch {
    return undefined;
  }
}
