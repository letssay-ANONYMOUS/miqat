import {
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PolarCircleResolution,
  PrayerTimes,
  Qibla,
  Rounding,
  Shafaq,
  SunnahTimes,
} from 'adhan';
import { METHOD_BY_KEY, type MethodKey } from './methods';
import { nearestStation } from './uaeStations';
import { officialTimes } from './officialTimetable';
import type { Language } from './i18n';

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export const PRAYER_ORDER: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const PRAYER_META: Record<PrayerKey, { en: string; ar: string; note: string; noteAr: string }> = {
  fajr: { en: 'Fajr', ar: 'الفجر', note: 'True dawn', noteAr: 'الفجر الصادق' },
  sunrise: { en: 'Sunrise', ar: 'الشروق', note: 'Fajr window closes', noteAr: 'نهاية وقت الفجر' },
  dhuhr: { en: 'Dhuhr', ar: 'الظهر', note: 'Sun past the meridian', noteAr: 'بعد زوال الشمس' },
  asr: { en: 'Asr', ar: 'العصر', note: 'Shadow length rule', noteAr: 'بحسب طول الظل' },
  maghrib: { en: 'Maghrib', ar: 'المغرب', note: 'Sunset', noteAr: 'غروب الشمس' },
  isha: { en: 'Isha', ar: 'العشاء', note: 'Twilight gone', noteAr: 'غياب الشفق' },
};

export interface Settings {
  language: Language;
  method: MethodKey;
  madhab: 'shafi' | 'hanafi';
  highLatitudeRule: 'auto' | 'middleofthenight' | 'seventhofthenight' | 'twilightangle';
  shafaq: 'general' | 'ahmer' | 'abyad';
  /** Per-prayer manual correction in minutes, to match the local mosque. */
  offsets: Record<PrayerKey, number>;
  /** Observer height above sea level in metres; sinks sunrise/Maghrib to the true horizon. */
  elevation: number;
  /**
   * Off by default: published timetables — Awqaf's included — are computed at
   * sea level, so applying the correction moves you away from the printed time
   * your mosque calls. It is here for anyone who wants the true local horizon.
   */
  useElevation: boolean;
  /** Only used when method === 'Custom'. */
  customFajrAngle: number;
  customIshaAngle: number;
  customIshaInterval: number;
  hijriOffset: number;
  timeFormat: '24h' | '12h';
  clockStyle: 'light' | 'serif' | 'mono' | 'words' | 'target';
  prayerLayout: 'list' | 'grid';
  dialStyle: 'arc' | 'ticks' | 'sweep' | 'orbit' | 'chronograph';
  /**
   * Minutes from the adhan to the iqama. Awqaf's standard across the UAE is 20
   * minutes for Fajr, Dhuhr, Asr and Isha and 5 for Maghrib; individual mosques
   * do vary, so every one is adjustable. Sunrise is null — it is not a prayer.
   */
  iqamaOffsets: Record<PrayerKey, number | null>;
  /** Friday replaces Dhuhr with Jumu'ah at a time the authority fixes. */
  jumuahTime: string;
  notifyEnabled: boolean;
  /** Minutes of warning before each time; 0 fires at the time itself. */
  notifyLead: number;
  lockScreenEnabled: boolean;
  /** Which countdown the Dynamic Island / lock screen shows. */
  lockScreenMode: 'adhan' | 'iqama';
  soundEnabled: boolean;
  /** 0 to 1. */
  soundVolume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  method: 'MuslimWorldLeague',
  madhab: 'shafi',
  highLatitudeRule: 'auto',
  shafaq: 'general',
  offsets: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  elevation: 0,
  useElevation: false,
  customFajrAngle: 18,
  customIshaAngle: 17,
  customIshaInterval: 0,
  hijriOffset: 0,
  timeFormat: '24h',
  clockStyle: 'light',
  prayerLayout: 'list',
  dialStyle: 'arc',
  iqamaOffsets: { fajr: 20, sunrise: null, dhuhr: 20, asr: 20, maghrib: 5, isha: 20 },
  jumuahTime: '12:45',
  notifyEnabled: false,
  notifyLead: 0,
  lockScreenEnabled: false,
  lockScreenMode: 'adhan',
  soundEnabled: false,
  soundVolume: 0.6,
};

export interface DayTimes {
  date: Date;
  times: Record<PrayerKey, Date>;
  sunset: Date;
  midnight: Date;
  lastThird: Date;
  /** Minutes the elevation correction moved sunrise and Maghrib. */
  elevationShiftMinutes: number;
  /** Whether these came from the authority's own table or from astronomy. */
  source: 'official' | 'computed';
  /** The published city whose table was used, when one was. */
  officialCity?: string;
}

function buildParams(settings: Settings, coords: Coordinates) {
  const info = METHOD_BY_KEY.get(settings.method) ?? METHOD_BY_KEY.get('MuslimWorldLeague')!;
  const params = info.build();

  if (settings.method === 'Custom') {
    params.fajrAngle = settings.customFajrAngle;
    params.ishaAngle = settings.customIshaAngle;
    params.ishaInterval = settings.customIshaInterval;
  }

  /*
   * Awqaf publishes a separate table per city, and the sub-minute residual
   * differs between them, so the nearest published city's own fitted offsets
   * win over the method's general set. Further out, the general set applies.
   */
  if (settings.method === 'Dubai') {
    const station = nearestStation(coords.latitude, coords.longitude);
    if (station) Object.assign(params.methodAdjustments, station.offsets);
  }

  params.madhab = settings.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule =
    settings.highLatitudeRule === 'auto'
      ? HighLatitudeRule.recommended(coords)
      : settings.highLatitudeRule;
  params.shafaq =
    settings.shafaq === 'ahmer' ? Shafaq.Ahmer : settings.shafaq === 'abyad' ? Shafaq.Abyad : Shafaq.General;
  params.polarCircleResolution = PolarCircleResolution.AqrabYaum;
  // Keep sub-minute precision so the elevation shift is applied before rounding.
  params.rounding = Rounding.None;
  params.adjustments = { ...settings.offsets };
  return params;
}

/**
 * Solar declination in degrees (NOAA low-precision series). Used only to size
 * the elevation correction, which is a difference of two hour angles — errors
 * of a hundredth of a degree cancel out.
 */
function solarDeclination(date: Date): number {
  const n = date.getTime() / 86_400_000 - 10_957.5; // days since J2000.0
  const rad = Math.PI / 180;
  const meanLongitude = 280.46 + 0.9856474 * n;
  const meanAnomaly = (357.528 + 0.9856003 * n) * rad;
  const eclipticLongitude =
    (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * rad;
  const obliquity = (23.439 - 0.0000004 * n) * rad;
  return Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude)) / rad;
}

/**
 * Minutes by which sunrise moves earlier (and sunset later) for an observer
 * `elevation` metres above the visible horizon. Dip = 0.0347·√h degrees.
 */
export function elevationShiftMinutes(latitude: number, date: Date, elevation: number): number {
  if (!elevation || elevation <= 0) return 0;
  const rad = Math.PI / 180;
  const declination = solarDeclination(date) * rad;
  const lat = latitude * rad;
  const dip = 0.0347 * Math.sqrt(elevation);

  const hourAngle = (altitudeDeg: number) => {
    const cosH =
      (Math.sin(altitudeDeg * rad) - Math.sin(lat) * Math.sin(declination)) /
      (Math.cos(lat) * Math.cos(declination));
    if (cosH > 1 || cosH < -1) return null;
    return Math.acos(cosH) / rad;
  };

  const base = hourAngle(-0.833);
  const raised = hourAngle(-0.833 - dip);
  if (base === null || raised === null) return 0;
  return ((raised - base) / 15) * 60;
}

export function computeDay(
  latitude: number,
  longitude: number,
  date: Date,
  settings: Settings,
  /** Fractional-minute trim on top of the method, for fitting experiments. */
  trim?: Partial<Record<PrayerKey, number>>,
): DayTimes {
  const coords = new Coordinates(latitude, longitude);
  const params = buildParams(settings, coords);
  if (trim) {
    for (const key of PRAYER_ORDER) {
      params.methodAdjustments[key] += trim[key] ?? 0;
    }
  }
  const pt = new PrayerTimes(coords, date, params);
  const sunnah = new SunnahTimes(pt);

  // Two ways the horizon can be lowered: the convention's own terrain
  // correction, which applies by default because the authority's published
  // times already include it, or the user asking for their literal height.
  const info = METHOD_BY_KEY.get(settings.method);
  const effectiveHeight = settings.useElevation
    ? settings.elevation
    : settings.elevation * (info?.horizonFactor ?? 0);
  const shift = elevationShiftMinutes(latitude, date, effectiveHeight);
  const shiftMs = shift * 60_000;

  const rounding = info?.rounding ?? {};
  const round = (d: Date, key?: PrayerKey) => {
    const minutes = d.getTime() / 60_000;
    const settled = rounding[key as PrayerKey] === 'up' ? Math.ceil(minutes) : Math.round(minutes);
    return new Date(settled * 60_000);
  };

  /*
   * Where the authority publishes a table, show the table. Awqaf has already
   * settled the angle, the rounding, the terrain and every seasonal subtlety;
   * recomputing all of that can only introduce ways to differ from the mosque.
   * The user's own corrections still apply on top.
   */
  const official = settings.method === 'Dubai' ? officialTimes(latitude, longitude, date) : null;
  const times = official
    ? (Object.fromEntries(
        PRAYER_ORDER.map((key) => [
          key,
          new Date(official.times[key].getTime() + (settings.offsets[key] ?? 0) * 60_000),
        ]),
      ) as Record<PrayerKey, Date>)
    : {
        fajr: round(pt.fajr, 'fajr'),
        sunrise: round(new Date(pt.sunrise.getTime() - shiftMs), 'sunrise'),
        dhuhr: round(pt.dhuhr, 'dhuhr'),
        asr: round(pt.asr, 'asr'),
        maghrib: round(new Date(pt.maghrib.getTime() + shiftMs), 'maghrib'),
        isha: round(pt.isha, 'isha'),
      };

  return {
    date,
    source: official ? 'official' : 'computed',
    officialCity: official?.city,
    times,
    sunset: round(new Date(pt.sunset.getTime() + shiftMs)),
    midnight: round(sunnah.middleOfTheNight),
    lastThird: round(sunnah.lastThirdOfTheNight),
    elevationShiftMinutes: shift,
  };
}

/**
 * The congregation times: adhan plus each mosque's iqama gap. Sunrise is left
 * as-is because there is no congregation for it. On Friday, Dhuhr's iqama is
 * Jumu'ah, which is set by the clock rather than by an offset.
 */
export function applyIqama(day: DayTimes, settings: Settings, timezone: string): DayTimes {
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short' }).format(
    day.times.dhuhr,
  );
  const isFriday = weekday === 'Fri';

  const times = { ...day.times };
  for (const key of PRAYER_ORDER) {
    const offset = settings.iqamaOffsets[key];
    if (offset === null) continue;
    times[key] = new Date(day.times[key].getTime() + offset * 60_000);
  }

  if (isFriday && /^\d{1,2}:\d{2}$/.test(settings.jumuahTime)) {
    const [hours, minutes] = settings.jumuahTime.split(':').map(Number);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(day.times.dhuhr);
    const currentHour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const currentMinute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    const shift = (hours - currentHour) * 60 + (minutes - currentMinute);
    times.dhuhr = new Date(day.times.dhuhr.getTime() + shift * 60_000);
  }

  return { ...day, times };
}

/** True when the given day's Dhuhr falls on a Friday in this timezone. */
export function isFriday(day: DayTimes, timezone: string): boolean {
  return (
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short' }).format(
      day.times.dhuhr,
    ) === 'Fri'
  );
}

export interface NextPrayerInfo {
  key: PrayerKey;
  at: Date;
  tomorrow: boolean;
  /** The prayer period we are currently inside, or null before Fajr. */
  current: PrayerKey | null;
  msRemaining: number;
  /** 0 → previous prayer just passed, 1 → next prayer is now. */
  progress: number;
}

export function resolveNext(
  today: DayTimes,
  tomorrow: DayTimes,
  now: Date,
  yesterday?: DayTimes,
  skip: PrayerKey[] = [],
): NextPrayerInfo {
  const order = PRAYER_ORDER.filter((key) => !skip.includes(key));
  const stops: { key: PrayerKey; at: Date; tomorrow: boolean }[] = [
    ...order.map((key) => ({ key, at: today.times[key], tomorrow: false })),
    ...order.map((key) => ({ key, at: tomorrow.times[key], tomorrow: true })),
  ];

  const nextIndex = stops.findIndex((s) => s.at.getTime() > now.getTime());
  const next = stops[nextIndex] ?? stops[stops.length - 1];
  const previous =
    nextIndex > 0
      ? stops[nextIndex - 1]
      : yesterday
        ? { key: 'isha' as PrayerKey, at: yesterday.times.isha, tomorrow: false }
        : null;

  const span = previous ? next.at.getTime() - previous.at.getTime() : 0;
  const elapsed = previous ? now.getTime() - previous.at.getTime() : 0;

  return {
    key: next.key,
    at: next.at,
    tomorrow: next.tomorrow,
    current: previous ? previous.key : null,
    msRemaining: Math.max(0, next.at.getTime() - now.getTime()),
    progress: span > 0 ? Math.min(1, Math.max(0, elapsed / span)) : 0,
  };
}

export function qiblaDegrees(latitude: number, longitude: number): number {
  return Qibla(new Coordinates(latitude, longitude));
}
