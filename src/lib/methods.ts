import { CalculationMethod, CalculationParameters } from 'adhan';
import type { PrayerKey } from './prayer';

/**
 * Every entry here mirrors a real, published convention. `aladhanId` is the
 * matching method id on api.aladhan.com so the same configuration can be
 * verified against an independent implementation (see lib/verify.ts).
 */
export type MethodKey =
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'UmmAlQura'
  | 'Dubai'
  | 'Qatar'
  | 'Kuwait'
  | 'Gulf'
  | 'MoonsightingCommittee'
  | 'NorthAmerica'
  | 'Singapore'
  | 'Jakim'
  | 'Indonesia'
  | 'Turkey'
  | 'Tehran'
  | 'Jafari'
  | 'France'
  | 'Russia'
  | 'Tunisia'
  | 'Algeria'
  | 'Morocco'
  | 'Portugal'
  | 'Jordan'
  | 'Custom';

export interface MethodInfo {
  key: MethodKey;
  label: string;
  /** Where this convention is actually used, shown under the picker. */
  region: string;
  /** api.aladhan.com method id, or null when there is no equivalent. */
  aladhanId: number | null;
  /** Human-readable parameter summary, e.g. "Fajr 18.2° · Isha 18.2°". */
  summary: string;
  /** Why an independent check is expected to disagree, when it is. */
  verifyNote?: string;
  /**
   * How the authority rounds each prayer to the minute. Matching this matters
   * more than it sounds: rounding the same way as the source parks our value in
   * the middle of the minute rather than on its boundary, where a few seconds
   * of seasonal drift would otherwise flip the displayed minute.
   */
  rounding?: Partial<Record<PrayerKey, 'nearest' | 'up'>>;
  /**
   * Fraction of the observer's height above sea level that counts as height
   * above the *visible* horizon, for authorities whose published table includes
   * a horizon correction. Standing 275 m up on a plateau is not standing on a
   * 275 m tower: the land around you is high too, so the horizon barely drops.
   */
  horizonFactor?: number;
  /**
   * Whether this convention has been checked against the timetable its own
   * authority publishes. Unverified does not mean wrong — the astronomy is the
   * same everywhere and the parameters come from published sources — it means
   * nobody has proved it matches what the local mosques actually call. The app
   * says which it is rather than implying one guarantee for all of them.
   */
  verifiedAgainst?: { authority: string; comparisons: number; withinOneMinute: number };
  build: () => CalculationParameters;
}

/** Build params for a convention adhan has no preset for. */
function custom(
  fajrAngle: number,
  ishaAngle: number,
  opts: { ishaInterval?: number; maghribAngle?: number; adjust?: Partial<Adjustments> } = {},
): CalculationParameters {
  const params = new CalculationParameters(
    null,
    fajrAngle,
    ishaAngle,
    opts.ishaInterval ?? 0,
    opts.maghribAngle ?? 0,
  );
  if (opts.adjust) Object.assign(params.methodAdjustments, opts.adjust);
  return params;
}

export interface Adjustments {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export const METHODS: MethodInfo[] = [
  {
    key: 'MuslimWorldLeague',
    label: 'Muslim World League',
    region: 'Europe, Far East, default worldwide',
    aladhanId: 3,
    summary: 'Fajr 18° · Isha 17°',
    build: CalculationMethod.MuslimWorldLeague,
  },
  {
    key: 'Egyptian',
    label: 'Egyptian General Authority of Survey',
    region: 'Egypt, Syria, Iraq, Lebanon, Malaysia',
    aladhanId: 5,
    summary: 'Fajr 19.5° · Isha 17.5°',
    build: CalculationMethod.Egyptian,
  },
  {
    key: 'Karachi',
    label: 'University of Islamic Sciences, Karachi',
    region: 'Pakistan, Bangladesh, India, Afghanistan',
    aladhanId: 1,
    summary: 'Fajr 18° · Isha 18°',
    build: CalculationMethod.Karachi,
  },
  {
    key: 'UmmAlQura',
    label: 'Umm al-Qura University, Makkah',
    region: 'Saudi Arabia',
    aladhanId: 4,
    summary: 'Fajr 18.5° · Isha 90 min after Maghrib',
    build: CalculationMethod.UmmAlQura,
  },
  {
    key: 'Dubai',
    label: 'UAE — Awqaf',
    region: 'United Arab Emirates',
    aladhanId: 16,
    summary: 'Fajr 18.2° · Isha 18.2° · Awqaf offsets',
    verifyNote:
      'Sunrise, Asr and Maghrib are expected to differ here. AlAdhan ships the raw Dubai angles; this app uses offsets fitted to the published Awqaf timetable, plus the terrain correction that timetable includes. Where the two disagree, the app is the one matching what the mosques call.',
    /*
     * Awqaf's table does correct for terrain, but not by the full height: at Al
     * Ain, the one elevated city it publishes, the correction behaves like ~75 m
     * against a true 275 m. Measured across 243 days — 0.27 takes that city from
     * 88.2% to 99.9% of times within a minute, and moves the sea-level cities by
     * a fifth of a minute, which rounds away. See `npm run verify`.
     */
    horizonFactor: 0.27,
    /*
     * Awqaf rounds Asr up, never down — it is not announced before it is due.
     * Recovering the shadow factor from 1,936 published Asr times gives the
     * standard 1.0, and modelling it as standard-plus-round-up reproduces
     * 79% of them with no fitted offset at all and, crucially, holds steady
     * month to month (75–82%) where rounding to nearest swings 42–55%.
     */
    rounding: { asr: 'up' },
    verifiedAgainst: {
      authority: 'the Awqaf timetable for all seven emirates and Al Ain',
      comparisons: 11616,
      withinOneMinute: 1,
    },
    /*
     * adhan ships Asr +3 for this method and AlAdhan ships Asr +0 with no
     * sunrise shift; neither reproduces the Awqaf table. Fitted against the
     * published August 2026 Dubai timetable (reference/uae-awqaf-dubai-2026-08.json)
     * this set lands within one minute on every prayer, every day — see
     * `npm run verify`.
     */
    build: () => {
      const params = CalculationMethod.Dubai();
      /*
       * Fractional, not whole minutes. Whole-minute offsets left Dhuhr sitting
       * ~36 s and Isha ~42 s late against the published table, which pushed
       * both over the rounding boundary most days: only 56% of times landed on
       * the right minute. Fitting each prayer to the nearest 0.05 min over
       * 4,392 published times lifts that to 78%, and 99.9% within a minute.
       */
      Object.assign(params.methodAdjustments, {
        fajr: 0.29,
        sunrise: -3.17,
        dhuhr: 2.31,
        asr: 0.59,
        maghrib: 2.65,
        isha: -0.76,
      });
      return params;
    },
  },
  {
    key: 'Qatar',
    label: 'Qatar',
    region: 'Qatar',
    aladhanId: 10,
    summary: 'Fajr 18° · Isha 90 min after Maghrib',
    build: CalculationMethod.Qatar,
  },
  {
    key: 'Kuwait',
    label: 'Kuwait',
    region: 'Kuwait',
    aladhanId: 9,
    summary: 'Fajr 18° · Isha 17.5°',
    build: CalculationMethod.Kuwait,
  },
  {
    key: 'Gulf',
    label: 'Gulf Region',
    region: 'Bahrain, Oman and the wider Gulf',
    aladhanId: 8,
    summary: 'Fajr 19.5° · Isha 90 min after Maghrib',
    build: () => custom(19.5, 0, { ishaInterval: 90 }),
  },
  {
    key: 'MoonsightingCommittee',
    label: 'Moonsighting Committee Worldwide',
    region: 'North America and the UK (seasonally adjusted)',
    aladhanId: 15,
    summary: 'Fajr 18° · Isha 18° · seasonal correction',
    build: CalculationMethod.MoonsightingCommittee,
  },
  {
    key: 'NorthAmerica',
    label: 'ISNA — Islamic Society of North America',
    region: 'North America',
    aladhanId: 2,
    summary: 'Fajr 15° · Isha 15°',
    build: CalculationMethod.NorthAmerica,
  },
  {
    key: 'Singapore',
    label: 'Majlis Ugama Islam Singapura',
    region: 'Singapore',
    aladhanId: 11,
    summary: 'Fajr 20° · Isha 18°',
    build: CalculationMethod.Singapore,
  },
  {
    key: 'Jakim',
    label: 'JAKIM',
    region: 'Malaysia',
    aladhanId: 17,
    summary: 'Fajr 20° · Isha 18°',
    build: () => custom(20, 18),
  },
  {
    key: 'Indonesia',
    label: 'Kementerian Agama Republik Indonesia',
    region: 'Indonesia',
    aladhanId: 20,
    summary: 'Fajr 20° · Isha 18°',
    build: () => custom(20, 18),
  },
  {
    key: 'Turkey',
    label: 'Diyanet İşleri Başkanlığı',
    region: 'Turkey',
    aladhanId: 13,
    summary: 'Fajr 18° · Isha 17°',
    build: CalculationMethod.Turkey,
  },
  {
    key: 'Tehran',
    label: 'Institute of Geophysics, University of Tehran',
    region: 'Iran',
    aladhanId: 7,
    summary: 'Fajr 17.7° · Maghrib 4.5° · Isha 14°',
    build: CalculationMethod.Tehran,
  },
  {
    key: 'Jafari',
    label: 'Shia Ithna-Ashari, Leva Institute, Qum',
    region: 'Shia Ithna-Ashari',
    aladhanId: 0,
    summary: 'Fajr 16° · Maghrib 4° · Isha 14°',
    build: () => custom(16, 14, { maghribAngle: 4 }),
  },
  {
    key: 'France',
    label: 'Union des Organisations Islamiques de France',
    region: 'France',
    aladhanId: 12,
    summary: 'Fajr 12° · Isha 12°',
    build: () => custom(12, 12),
  },
  {
    key: 'Russia',
    label: 'Spiritual Administration of Muslims of Russia',
    region: 'Russia',
    aladhanId: 14,
    summary: 'Fajr 16° · Isha 15°',
    build: () => custom(16, 15),
  },
  {
    key: 'Tunisia',
    label: 'Tunisia',
    region: 'Tunisia',
    aladhanId: 18,
    summary: 'Fajr 18° · Isha 18°',
    build: () => custom(18, 18),
  },
  {
    key: 'Algeria',
    label: 'Algeria',
    region: 'Algeria',
    aladhanId: 19,
    summary: 'Fajr 18° · Isha 17°',
    build: () => custom(18, 17),
  },
  {
    key: 'Morocco',
    label: 'Morocco',
    region: 'Morocco',
    aladhanId: 21,
    summary: 'Fajr 19° · Isha 17°',
    build: () => custom(19, 17),
  },
  {
    key: 'Portugal',
    label: 'Comunidade Islâmica de Lisboa',
    region: 'Portugal',
    aladhanId: 22,
    summary: 'Fajr 18° · Maghrib +3 min · Isha +77 min',
    build: () => custom(18, 0, { ishaInterval: 77, adjust: { maghrib: 3 } }),
  },
  {
    key: 'Jordan',
    label: 'Ministry of Awqaf, Jordan',
    region: 'Jordan',
    aladhanId: 23,
    summary: 'Fajr 18° · Maghrib +5 min · Isha 18°',
    build: () => custom(18, 18, { adjust: { maghrib: 5 } }),
  },
  {
    key: 'Custom',
    label: 'Custom angles',
    region: 'Set your own Fajr and Isha angles',
    aladhanId: 99,
    summary: 'Your own parameters',
    build: () => custom(18, 17),
  },
];

export const METHOD_BY_KEY = new Map(METHODS.map((m) => [m.key, m]));

/**
 * Which convention the local mosques actually follow, by ISO country code.
 * Athan Pro does the same thing — the single biggest source of "wrong" times
 * is a global default applied to a country that uses something else.
 */
export const COUNTRY_METHOD: Record<string, MethodKey> = {
  AE: 'Dubai',
  SA: 'UmmAlQura',
  QA: 'Qatar',
  KW: 'Kuwait',
  BH: 'Gulf',
  OM: 'Gulf',
  YE: 'UmmAlQura',
  EG: 'Egyptian',
  SD: 'Egyptian',
  SY: 'Egyptian',
  IQ: 'Egyptian',
  LB: 'Egyptian',
  PS: 'Egyptian',
  JO: 'Jordan',
  PK: 'Karachi',
  IN: 'Karachi',
  BD: 'Karachi',
  AF: 'Karachi',
  LK: 'Karachi',
  US: 'MoonsightingCommittee',
  CA: 'MoonsightingCommittee',
  GB: 'MoonsightingCommittee',
  MX: 'NorthAmerica',
  SG: 'Singapore',
  MY: 'Jakim',
  BN: 'Jakim',
  ID: 'Indonesia',
  TR: 'Turkey',
  IR: 'Tehran',
  FR: 'France',
  RU: 'Russia',
  KZ: 'Russia',
  UZ: 'Russia',
  KG: 'Russia',
  TJ: 'Russia',
  AZ: 'Russia',
  TN: 'Tunisia',
  DZ: 'Algeria',
  MA: 'Morocco',
  LY: 'Morocco',
  PT: 'Portugal',
};

/**
 * Rough boxes for places where guessing wrong is worst — used only when reverse
 * geocoding fails to name a country, which happens offline or when the lookup
 * is blocked. The country code always wins when we have one.
 */
const COORDINATE_FALLBACK: { method: MethodKey; south: number; north: number; west: number; east: number }[] = [
  { method: 'Dubai', south: 22.5, north: 26.2, west: 51.4, east: 56.5 },
  { method: 'UmmAlQura', south: 16.3, north: 32.2, west: 34.4, east: 55.7 },
];

export function methodForPlace(countryCode?: string | null, latitude?: number, longitude?: number): MethodKey {
  const fromCountry = countryCode ? COUNTRY_METHOD[countryCode.toUpperCase()] : undefined;
  if (fromCountry) return fromCountry;
  if (countryCode) return 'MuslimWorldLeague';

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    const box = COORDINATE_FALLBACK.find(
      (b) => latitude >= b.south && latitude <= b.north && longitude >= b.west && longitude <= b.east,
    );
    if (box) return box.method;
  }
  return 'MuslimWorldLeague';
}
