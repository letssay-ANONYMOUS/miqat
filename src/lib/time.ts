/**
 * Prayer times are absolute instants, so the only thing that matters for a
 * correct display is formatting them in the *location's* timezone rather than
 * the device's. Everything here goes through Intl with an explicit timeZone.
 */

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string, options: Intl.DateTimeFormatOptions, locale = 'en-GB') {
  const key = `${locale}|${tz}|${JSON.stringify(options)}`;
  let fmt = partsCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { timeZone: tz, ...options });
    partsCache.set(key, fmt);
  }
  return fmt;
}

/** The calendar date currently showing on a wall clock in `tz`. */
export function civilDateIn(tz: string, instant: Date = new Date()): CivilDate {
  const parts = formatter(tz, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    instant,
  );
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return { year: get('year'), month: get('month'), day: get('day') };
}

/**
 * A Date whose *device-local* Y/M/D equals the civil date in `tz`, shifted by
 * `dayOffset`. adhan reads Y/M/D with local getters, so this is what it needs.
 */
export function dayAnchor(tz: string, dayOffset = 0, instant: Date = new Date()): Date {
  const { year, month, day } = civilDateIn(tz, instant);
  return new Date(year, month - 1, day + dayOffset, 12);
}

export function formatTime(date: Date, tz: string, format: '24h' | '12h'): string {
  return formatter(tz, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: format === '12h',
  })
    .format(date)
    .replace(/\s?(am|pm)/i, (m) => m.toUpperCase());
}

export function formatLongDate(date: Date, tz: string): string {
  return formatter(tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    date,
  );
}

export function formatHijri(date: Date, tz: string, offsetDays = 0): string {
  const shifted = new Date(date.getTime() + offsetDays * 86_400_000);
  try {
    return new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', {
      timeZone: tz,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(shifted);
  } catch {
    return '';
  }
}

export function countdown(ms: number): { hours: number; minutes: number; seconds: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function formatCountdown(ms: number): string {
  const { hours, minutes, seconds } = countdown(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** "in 2 h 14 min" style, for screen readers and secondary labels. */
export function humanRemaining(ms: number): string {
  const { hours, minutes } = countdown(ms);
  if (hours === 0 && minutes === 0) return 'less than a minute';
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

/** Fraction of the day elapsed in `tz`, for the sun arc. */
export function dayFraction(instant: Date, tz: string): number {
  const parts = formatter(tz, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const hour = get('hour') % 24;
  return (hour * 3600 + get('minute') * 60 + get('second')) / 86_400;
}
