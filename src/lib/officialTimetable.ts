import table from '../data/uae-timetable.json';
import type { PrayerKey } from './prayer';

/**
 * The published Awqaf timetable, shipped with the app.
 *
 * Where this has an answer, the app shows it rather than calculating. Awqaf has
 * already decided the angle, the rounding, the terrain and every seasonal
 * subtlety; re-deriving all of that only creates opportunities to differ from
 * the mosque. Calculation remains the fallback — for towns without a published
 * table, for dates beyond it, and for the rest of the world.
 *
 * Every day in here passed validation at build time (`npm run build:timetable`).
 * Days the feed got wrong are simply absent, and those fall through to the
 * calculation: a gap is recoverable, a wrong prayer time is not.
 */

/** The UAE keeps UTC+4 all year, so a wall-clock time is one instant. */
const UTC_OFFSET_HOURS = 4;
/** Beyond this from a published city, its table does not describe your sky. */
const MAX_DISTANCE_KM = 40;

const ORDER = table.order as PrayerKey[];

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function publishedCityFor(latitude: number, longitude: number): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const station of table.stations) {
    const distance = distanceKm(latitude, longitude, station.latitude, station.longitude);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = station.city;
    }
  }
  return bestDistance <= MAX_DISTANCE_KM ? best : null;
}

export interface OfficialDay {
  city: string;
  times: Record<PrayerKey, Date>;
}

/**
 * The published times for this place and date, or null when the table does not
 * cover it. `date` is read as a civil date in the UAE.
 */
export function officialTimes(
  latitude: number,
  longitude: number,
  date: Date,
): OfficialDay | null {
  const city = publishedCityFor(latitude, longitude);
  if (!city) return null;

  const year = date.getFullYear();
  if (year !== table.year) return null;

  const rows = (table.cities as Record<string, Record<string, number[]>>)[city];
  const minutes = rows?.[`${date.getMonth() + 1}-${date.getDate()}`];
  if (!minutes || minutes.length !== ORDER.length) return null;

  const times = {} as Record<PrayerKey, Date>;
  ORDER.forEach((key, index) => {
    const value = minutes[index];
    times[key] = new Date(
      Date.UTC(year, date.getMonth(), date.getDate(), Math.floor(value / 60) - UTC_OFFSET_HOURS, value % 60),
    );
  });

  return { city, times };
}

export const TIMETABLE_SOURCE = table.source;
export const TIMETABLE_YEAR = table.year;
