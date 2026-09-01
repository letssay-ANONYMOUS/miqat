import { METHOD_BY_KEY } from './methods';
import { PRAYER_ORDER, computeDay, type PrayerKey, type Settings } from './prayer';
import { civilDateIn } from './time';

/**
 * Independent cross-check. The same method, madhab and high-latitude rule are
 * sent to api.aladhan.com (a separate implementation, in PHP) and its answer is
 * diffed against ours minute by minute.
 *
 * The comparison deliberately excludes the local elevation correction and the
 * user's manual offsets — neither exists on the remote side, so including them
 * would manufacture a disagreement.
 */

const API = 'https://api.aladhan.com/v1/timings';

export interface VerifyRow {
  key: PrayerKey;
  local: string;
  remote: string;
  deltaMinutes: number;
}

export interface VerifyResult {
  ok: boolean;
  rows: VerifyRow[];
  maxDelta: number;
  methodLabel: string;
  checkedAt: Date;
  note?: string;
}

const HIGH_LAT_TO_API: Record<string, number> = {
  middleofthenight: 1,
  seventhofthenight: 2,
  twilightangle: 3,
};

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export async function verifyAgainstAladhan(
  latitude: number,
  longitude: number,
  timezone: string,
  settings: Settings,
  signal?: AbortSignal,
): Promise<VerifyResult> {
  const info = METHOD_BY_KEY.get(settings.method);
  if (!info || info.aladhanId === null) {
    throw new Error(`${info?.label ?? 'This method'} has no equivalent to check against.`);
  }

  // Local side: same parameters, but no elevation shift and no manual offsets.
  const bare: Settings = {
    ...settings,
    useElevation: false,
    offsets: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  };
  const { year, month, day } = civilDateIn(timezone);
  const anchor = new Date(year, month - 1, day, 12);
  const local = computeDay(latitude, longitude, anchor, bare);

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    method: String(info.aladhanId),
    school: settings.madhab === 'hanafi' ? '1' : '0',
    timezonestring: timezone,
  });
  if (settings.method === 'Custom') {
    params.set('methodSettings', `${settings.customFajrAngle},null,${settings.customIshaAngle}`);
  }
  if (settings.highLatitudeRule !== 'auto') {
    params.set('latitudeAdjustmentMethod', String(HIGH_LAT_TO_API[settings.highLatitudeRule]));
  }

  const date = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
  const res = await fetch(`${API}/${date}?${params}`, { signal });
  if (!res.ok) throw new Error(`AlAdhan returned ${res.status}`);
  const payload = (await res.json()) as {
    data: { timings: Record<string, string> };
  };

  const remoteKey: Record<PrayerKey, string> = {
    fajr: 'Fajr',
    sunrise: 'Sunrise',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
  };

  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const rows: VerifyRow[] = PRAYER_ORDER.map((key) => {
    const localTime = fmt.format(local.times[key]);
    const remoteTime = (payload.data.timings[remoteKey[key]] ?? '').slice(0, 5);
    const delta = remoteTime ? minutesOfDay(localTime) - minutesOfDay(remoteTime) : 0;
    return { key, local: localTime, remote: remoteTime, deltaMinutes: delta };
  });

  const maxDelta = rows.reduce((max, r) => Math.max(max, Math.abs(r.deltaMinutes)), 0);

  return {
    ok: maxDelta <= 1,
    rows,
    maxDelta,
    methodLabel: info.label,
    checkedAt: new Date(),
    note: [
      info.verifyNote,
      settings.useElevation && settings.elevation > 0
        ? 'Compared without the elevation correction — AlAdhan has no elevation input.'
        : null,
    ]
      .filter(Boolean)
      .join(' '),
  };
}
