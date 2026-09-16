/**
 * Regression test for the calculation engine.
 *
 * Every prayer time this app shows is computed on the device, so "is it
 * accurate?" has to be answered against the timetable people actually pray by.
 * reference/ holds those, straight from the publishers of the Awqaf tables;
 * this script recomputes every day and reports the spread.
 *
 * Elevation is off here on purpose: it is a per-observer correction with no
 * counterpart in a published table, so leaving it in would only blur what is
 * being tested — the convention itself.
 *
 * The shipped timetable is bypassed here. The app serves Awqaf's published
 * table verbatim where it has one, so leaving that path in would compare the
 * table against the table it was built from and report a perfect score that
 * says nothing about the astronomy. The second pass checks that lookup path
 * separately, where an exact match is the whole point.
 *
 *   npm run verify
 */
import uae from '../reference/uae-awqaf-2026.json';
import ktDubai from '../reference/uae-awqaf-dubai-2026-08.json';
import { computeDay, DEFAULT_SETTINGS, PRAYER_ORDER, type PrayerKey } from '../src/lib/prayer';
import type { MethodKey } from '../src/lib/methods';

interface Day {
  day: number;
}

type DayRow = Day & Record<PrayerKey, string>;

interface Station {
  city: string;
  latitude: number;
  longitude: number;
  /** Ground height, so the convention's terrain correction is under test too. */
  elevation: number;
  months: { month: number; days: DayRow[] }[];
}

interface Suite {
  label: string;
  source: string;
  timezone: string;
  year: number;
  method: MethodKey;
  madhab: 'shafi' | 'hanafi';
  tolerance: number;
  /** Share of all checks that must land within a single minute. */
  minWithinOneMinute: number;
  stations: Station[];
  note?: string;
}

const SUITES: Suite[] = [
  {
    label: 'UAE · Awqaf via Gulf News',
    source: uae.source,
    timezone: uae.timezone,
    year: uae.year,
    method: 'Dubai',
    madhab: 'shafi',
    tolerance: 3,
    minWithinOneMinute: 0.99,
    note:
      "Worst case is Awqaf's own reference point for a city, not an error in the maths: the " +
      'published time is computed for one spot per emirate while the app computes for yours. ' +
      'The share within a single minute is the number that matters.',
    stations: uae.cities as Station[],
  },
  {
    label: 'Dubai · Awqaf via Khaleej Times',
    source: ktDubai.source,
    timezone: ktDubai.timezone,
    year: ktDubai.year,
    method: 'Dubai',
    madhab: 'shafi',
    tolerance: 1,
    minWithinOneMinute: 1,
    note: 'A second publisher of the same official table, as a cross-check on the first.',
    stations: [
      {
        city: ktDubai.city,
        latitude: ktDubai.latitude,
        longitude: ktDubai.longitude,
        elevation: ktDubai.elevation,
        months: [{ month: ktDubai.month, days: ktDubai.days as DayRow[] }],
      },
    ],
  },
];

function minutesOfDay(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

let failed = false;

/**
 * 'engine'    recompute every day from the sun and diff against the publisher.
 * 'timetable' serve the shipped table and diff against the publisher, which
 *             checks the build pipeline copied it faithfully.
 */
type Mode = 'engine' | 'timetable';

function run(suite: Suite, mode: Mode) {
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone: suite.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // useElevation stays off: that switch is the user asking for their literal
  // height. What is under test is the convention's own terrain correction,
  // which the engine applies from the station's elevation on its own.
  const baseSettings = {
    ...DEFAULT_SETTINGS,
    method: suite.method,
    madhab: suite.madhab,
    useElevation: false,
  };

  const tolerance = mode === 'timetable' ? 0 : suite.tolerance;
  const floor = mode === 'timetable' ? 1 : suite.minWithinOneMinute;

  console.log(`\n${suite.label} · ${LABEL[mode]} · tolerance ${tolerance} min`);
  console.log(`  ${suite.source}`);
  if (mode === 'engine' && suite.note) console.log(`  ${suite.note}`);

  const overall: Record<PrayerKey, number[]> = {
    fajr: [], sunrise: [], dhuhr: [], asr: [], maghrib: [], isha: [],
  };

  for (const station of suite.stations) {
    const deltas: Record<PrayerKey, number[]> = {
      fajr: [], sunrise: [], dhuhr: [], asr: [], maghrib: [], isha: [],
    };
    const settings = { ...baseSettings, elevation: station.elevation ?? 0 };
    for (const { month, days } of station.months) {
      for (const row of days) {
        const anchor = new Date(suite.year, month - 1, row.day, 12);
        const computed = computeDay(
          station.latitude,
          station.longitude,
          anchor,
          settings,
          undefined,
          mode === 'timetable',
        );
        for (const key of PRAYER_ORDER) {
          const delta = minutesOfDay(format.format(computed.times[key])) - minutesOfDay(row[key]);
          deltas[key].push(delta);
          overall[key].push(delta);
        }
      }
    }

    const worst = Math.max(...PRAYER_ORDER.map((k) => Math.max(...deltas[k].map(Math.abs))));
    const total = deltas.fajr.length;
    const within1 = PRAYER_ORDER.flatMap((k) => deltas[k]).filter((d) => Math.abs(d) <= 1).length;
    const checks = total * PRAYER_ORDER.length;
    if (worst > tolerance) failed = true;
    console.log(
      `  ${worst > tolerance ? 'FAIL' : 'ok  '} ${station.city.padEnd(16)} ` +
        `${String(total).padStart(3)} days · worst ${worst} min · ` +
        `${((within1 / checks) * 100).toFixed(1)}% within a minute`,
    );
  }

  const allChecks = PRAYER_ORDER.flatMap((k) => overall[k]);
  const withinOne = allChecks.filter((d) => Math.abs(d) <= 1).length / allChecks.length;
  if (withinOne < floor) failed = true;

  console.log('  ' + '─'.repeat(58));
  console.log(
    `  ${withinOne < suite.minWithinOneMinute ? 'FAIL' : 'ok  '} ` +
      `${(withinOne * 100).toFixed(1)}% of ${allChecks.length} checks within a minute ` +
      `(needs ${(floor * 100).toFixed(0)}%)`,
  );
  for (const key of PRAYER_ORDER) {
    const values = overall[key];
    const worst = Math.max(...values.map(Math.abs));
    const exact = values.filter((v) => v === 0).length;
    console.log(
      `       ${key.padEnd(8)} worst ${String(worst).padStart(2)} min · ` +
        `exact on ${((exact / values.length) * 100).toFixed(0)}% of ${values.length} checks`,
    );
  }
}

const LABEL: Record<Mode, string> = {
  engine: 'computed from the sun',
  timetable: 'shipped timetable',
};

for (const suite of SUITES) run(suite, 'engine');
// The lookup path only has something to prove where a table actually ships.
run(SUITES[0], 'timetable');

console.log(
  failed
    ? '\nSome prayers drift further from the official tables than allowed.'
    : '\nEvery prayer is within tolerance of the official tables.',
);
process.exit(failed ? 1 : 0);
