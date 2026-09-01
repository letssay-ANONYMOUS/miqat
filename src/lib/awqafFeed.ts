import type { PrayerKey } from './prayer';

/**
 * Reading the published Awqaf timetable.
 *
 * Awqaf has no API and issues no keys — this is the feed Gulf News serves to
 * render its prayer-times page, which republishes the official table. It is
 * undocumented and unversioned, so everything here assumes it can change shape
 * or lie, and says so loudly rather than quietly returning wrong times.
 *
 * Two failure modes are known and both are guarded:
 *
 *  1. The feed silently falls back to a generic fixed-90-minute-Isha
 *     calculation instead of returning nothing — and it can do so part-way
 *     through a month, for one city only. The tell is Isha sitting exactly 90
 *     minutes after Maghrib, and it is checked per day.
 *  2. Individual days carry typos — a value several minutes off both its
 *     neighbours, which the sun cannot do.
 */

export interface Station {
  city: string;
  slug: string;
  latitude: number;
  longitude: number;
  elevation: number;
}

/** The eight places Awqaf publishes separately. */
export const STATIONS: Station[] = [
  { city: 'Dubai', slug: 'dubai', latitude: 25.2048, longitude: 55.2708, elevation: 5 },
  { city: 'Abu Dhabi', slug: 'abu_dhabi', latitude: 24.4539, longitude: 54.3773, elevation: 5 },
  { city: 'Sharjah', slug: 'sharjah', latitude: 25.3463, longitude: 55.4209, elevation: 15 },
  { city: 'Ajman', slug: 'ajman', latitude: 25.4052, longitude: 55.5136, elevation: 5 },
  { city: 'Fujairah', slug: 'fujairah', latitude: 25.1288, longitude: 56.3265, elevation: 10 },
  { city: 'Ras Al Khaimah', slug: 'ras_al_khaimah', latitude: 25.7895, longitude: 55.9432, elevation: 5 },
  { city: 'Umm Al Quwain', slug: 'umm_al_quwain', latitude: 25.5647, longitude: 55.5552, elevation: 3 },
  { city: 'Al Ain', slug: 'al_ain', latitude: 24.1917, longitude: 55.7606, elevation: 275 },
];

export const FEED_SOURCE = 'gulfnews';

const KEYS: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const AFTERNOON = new Set<PrayerKey>(['dhuhr', 'asr', 'maghrib', 'isha']);
const TIME = /^(\d{1,2}):(\d{2})$/;

export type OfficialDay = { day: number } & Record<PrayerKey, string>;

export interface MonthResult {
  station: Station;
  days: OfficialDay[];
  /** Why days or the whole month were discarded. */
  notes: string[];
}

/** The feed writes 12-hour times with no meridiem; the prayer decides which. */
function to24(value: string, key: PrayerKey): string | null {
  const match = TIME.exec(value ?? '');
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 12 || minutes > 59) return null;
  if (AFTERNOON.has(key) && hours !== 12) hours += 12;
  if (!AFTERNOON.has(key) && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export async function fetchMonth(
  station: Station,
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<MonthResult> {
  const url =
    `https://gulfnews.com/prayer-time?country=united_arab_emirates` +
    `&city=${station.slug}&month=${month}&year=${year}`;

  const response = await fetch(url, {
    signal,
    headers: { accept: 'application/json', 'user-agent': 'miqat-accuracy-audit' },
  });
  if (!response.ok) {
    return { station, days: [], notes: [`${station.city}: feed returned ${response.status}`] };
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const notes: string[] = [];
  const parsed: OfficialDay[] = [];

  for (let day = 1; day <= 31; day += 1) {
    const row = payload[`date${day}`] as Record<string, string> | undefined;
    if (!row) continue;
    const converted: Partial<OfficialDay> = { day };
    let bad = false;
    for (const key of KEYS) {
      const value = to24(row[key], key);
      if (value === null) {
        bad = true;
        break;
      }
      converted[key] = value;
    }
    if (bad) {
      notes.push(`${station.city} ${year}-${month}-${day}: unreadable time`);
      continue;
    }
    parsed.push(converted as OfficialDay);
  }

  if (parsed.length < 20) {
    return { station, days: [], notes: [...notes, `${station.city}: only ${parsed.length} usable days`] };
  }

  /*
   * Guard 1 — the generic fallback puts Isha exactly 90 minutes after Maghrib.
   * Checked per day, not per month: on 2026-09 the Dubai feed served the real
   * table for the first fifteen days and the fallback for the rest, which a
   * whole-month test waved straight through and which would have been reported
   * as a thirteen-minute drift that did not exist.
   */
  const real = parsed.filter((d) => toMinutes(d.isha) - toMinutes(d.maghrib) !== 90);
  const placeholders = parsed.length - real.length;
  if (placeholders > 0) {
    notes.push(`${station.city}: ${placeholders} day(s) served placeholder data, skipped`);
  }
  if (real.length < 15) {
    return {
      station,
      days: [],
      notes: [...notes, `${station.city}: too few genuine days (${real.length}) to compare`],
    };
  }
  parsed.length = 0;
  parsed.push(...real);

  // Guard 2 — drop single-day typos.
  const clean = parsed.filter((row, i) => {
    for (const key of KEYS) {
      let expected: number | null = null;
      if (i > 0 && i < parsed.length - 1) {
        expected = (toMinutes(parsed[i - 1][key]) + toMinutes(parsed[i + 1][key])) / 2;
      } else if (i === 0 && parsed.length >= 3) {
        expected = 2 * toMinutes(parsed[1][key]) - toMinutes(parsed[2][key]);
      } else if (i === parsed.length - 1 && parsed.length >= 3) {
        expected = 2 * toMinutes(parsed[parsed.length - 2][key]) - toMinutes(parsed[parsed.length - 3][key]);
      }
      if (expected !== null && Math.abs(toMinutes(row[key]) - expected) > 3) {
        notes.push(`${station.city} ${year}-${month}-${row.day}: ${key} is a spike, skipped`);
        return false;
      }
    }
    return true;
  });

  return { station, days: clean, notes };
}
