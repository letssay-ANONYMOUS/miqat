import { writeFileSync, mkdirSync } from 'node:fs';
import { STATIONS, fetchMonth, toMinutes, type OfficialDay } from '../src/lib/awqafFeed';
import { DEFAULT_SETTINGS, PRAYER_ORDER, computeDay, type PrayerKey } from '../src/lib/prayer';

/**
 * Builds the shipped copy of the official Awqaf timetable.
 *
 *   npm run build:timetable
 *
 * Awqaf already accounts for the season, the convention and the rounding, so
 * where their table exists the app should simply show it rather than try to
 * re-derive it. This fetches it, refuses anything that fails a check, and
 * writes what survives into src/data.
 *
 * Nothing here trusts the feed. It has been caught serving a generic
 * fixed-90-minute-Isha filler part-way through a month for a single city, and
 * carrying typo'd times on individual days. A day that fails any check is
 * dropped, and the app computes that day instead — a gap is recoverable, a
 * wrong prayer time is not.
 */

const YEAR = 2026;
const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dubai',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

interface Rejection {
  city: string;
  month: number;
  day: number;
  reason: string;
}

const rejections: Rejection[] = [];

/** Every check a day must pass before it is allowed to reach a user. */
function validate(
  station: (typeof STATIONS)[number],
  month: number,
  row: OfficialDay,
  neighbours: { before?: OfficialDay; after?: OfficialDay },
): boolean {
  const reject = (reason: string) => {
    rejections.push({ city: station.city, month, day: row.day, reason });
    return false;
  };

  const minutes = PRAYER_ORDER.map((k) => toMinutes(row[k]));

  // 1. The day must run forwards.
  for (let i = 1; i < minutes.length; i += 1) {
    if (minutes[i] <= minutes[i - 1]) return reject(`${PRAYER_ORDER[i]} is not after ${PRAYER_ORDER[i - 1]}`);
  }

  // 2. The generic filler pins Isha exactly 90 minutes after Maghrib.
  if (toMinutes(row.isha) - toMinutes(row.maghrib) === 90) return reject('placeholder data (90-minute Isha)');

  // 3. Sanity against our own astronomy. A few minutes apart is expected and
  //    fine; a large gap means the feed handed us the wrong city or date.
  const settings = { ...DEFAULT_SETTINGS, method: 'Dubai' as const, elevation: station.elevation };
  const computed = computeDay(station.latitude, station.longitude, new Date(YEAR, month - 1, row.day, 12), settings);
  for (const key of PRAYER_ORDER) {
    const drift = Math.abs(toMinutes(fmt.format(computed.times[key])) - toMinutes(row[key]));
    if (drift > 8) return reject(`${key} is ${drift} min from the calculation`);
  }

  // 4. No day may jump away from its neighbours; the sun does not do that.
  const { before, after } = neighbours;
  if (before && after) {
    for (const key of PRAYER_ORDER) {
      const expected = (toMinutes(before[key]) + toMinutes(after[key])) / 2;
      if (Math.abs(toMinutes(row[key]) - expected) > 3) return reject(`${key} jumps away from its neighbours`);
    }
  }

  return true;
}

async function main() {
  mkdirSync('src/data', { recursive: true });

  const cities: Record<string, Record<string, number[]>> = {};
  let kept = 0;
  let seen = 0;

  for (const station of STATIONS) {
    cities[station.city] = {};
    for (let month = 1; month <= 12; month += 1) {
      const result = await fetchMonth(station, YEAR, month).catch(() => null);
      if (!result || result.days.length === 0) continue;

      const days = result.days;
      for (let i = 0; i < days.length; i += 1) {
        seen += 1;
        const ok = validate(station, month, days[i], { before: days[i - 1], after: days[i + 1] });
        if (!ok) continue;
        const key = `${month}-${days[i].day}`;
        // Minutes since midnight: compact, and gzips well because it is smooth.
        cities[station.city][key] = PRAYER_ORDER.map((k) => toMinutes(days[i][k as PrayerKey]));
        kept += 1;
      }
    }
    const count = Object.keys(cities[station.city]).length;
    console.log(`${station.city.padEnd(16)} ${String(count).padStart(3)} days accepted`);
  }

  const doc = {
    source: 'General Authority of Islamic Affairs and Endowments (Awqaf), as published by Gulf News',
    url: 'https://gulfnews.com/prayer-times',
    year: YEAR,
    timezone: 'Asia/Dubai',
    built: new Date().toISOString().slice(0, 10),
    order: PRAYER_ORDER,
    note:
      'Minutes since midnight, keyed "month-day". Every day here passed validation; ' +
      'days the feed got wrong are absent on purpose and the app computes those.',
    stations: STATIONS.map((s) => ({
      city: s.city,
      latitude: s.latitude,
      longitude: s.longitude,
    })),
    cities,
  };

  writeFileSync('src/data/uae-timetable.json', JSON.stringify(doc));
  const bytes = JSON.stringify(doc).length;

  console.log(`\n${kept} of ${seen} days accepted · ${rejections.length} rejected · ${(bytes / 1024).toFixed(0)} kB raw`);
  if (rejections.length) {
    console.log('\nrejected:');
    const grouped = new Map<string, number>();
    for (const r of rejections) {
      const key = `${r.city}: ${r.reason}`;
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    for (const [key, n] of [...grouped].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${n.toString().padStart(3)}×  ${key}`);
    }
  }
}

main();
