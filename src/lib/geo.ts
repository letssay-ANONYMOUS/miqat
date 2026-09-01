export interface Place {
  name: string;
  admin?: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  elevation: number;
  /** How the coordinates were obtained — shown so accuracy is never a mystery. */
  source: 'gps' | 'search' | 'manual' | 'saved';
}

const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE = 'https://api-bdc.io/data/reverse-geocode-client';

interface OpenMeteoResult {
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone: string;
  country: string;
  country_code: string;
  admin1?: string;
}

/** City search. Open-Meteo's geocoder is free, key-less and CORS-enabled. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = `${GEOCODE}?name=${encodeURIComponent(trimmed)}&count=8&language=en&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Geocoder returned ${res.status}`);
  const data = (await res.json()) as { results?: OpenMeteoResult[] };
  return (data.results ?? []).map((r) => ({
    name: r.name,
    admin: r.admin1,
    country: r.country,
    countryCode: r.country_code,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
    elevation: r.elevation ?? 0,
    source: 'search' as const,
  }));
}

/** Name + country for a coordinate pair. Falls back to the raw coordinates. */
export async function describeCoordinates(
  latitude: number,
  longitude: number,
): Promise<{ name: string; admin?: string; country: string; countryCode: string }> {
  try {
    const res = await fetch(
      `${REVERSE}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    );
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
      countryCode?: string;
    };
    return {
      name: data.city || data.locality || 'Current location',
      admin: data.principalSubdivision,
      country: data.countryName ?? '',
      countryCode: data.countryCode ?? '',
    };
  } catch {
    return { name: 'Current location', country: '', countryCode: '' };
  }
}

/** Ground elevation in metres — feeds the horizon-dip correction. */
export async function lookupElevation(latitude: number, longitude: number): Promise<number> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${latitude}&longitude=${longitude}`,
    );
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { elevation?: number[] };
    return Math.max(0, Math.round(data.elevation?.[0] ?? 0));
  } catch {
    return 0;
  }
}

export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser has no location support.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 5 * 60_000,
    });
  });
}

/** GPS fix, enriched with a place name, timezone and elevation. */
export async function locateMe(): Promise<Place> {
  const position = await currentPosition();
  const { latitude, longitude } = position.coords;
  const [described, elevation] = await Promise.all([
    describeCoordinates(latitude, longitude),
    lookupElevation(latitude, longitude),
  ]);
  return {
    ...described,
    latitude: Number(latitude.toFixed(5)),
    longitude: Number(longitude.toFixed(5)),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    elevation,
    source: 'gps',
  };
}
