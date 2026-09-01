import type { PrayerKey } from './prayer';

/**
 * Per-city trim for the UAE.
 *
 * Awqaf does not publish one calculation and shift it per emirate — each city
 * has its own table, and the sub-minute residual against a computation from the
 * city's real coordinates differs from city to city. A single global set of
 * offsets therefore cannot suit all eight: fitting one lifted six cities but
 * knocked Dubai from 74.8% to 64.9% of times landing on the published minute,
 * and Al Ain from 71.0% to 54.1%.
 *
 * Fitting each city separately, against its own table over eight months, puts
 * every one of them between 86% and 93%. These are the fitted offsets; the
 * nearest station within `MAX_DISTANCE_KM` wins, and anyone further away falls
 * back to the method's own set. Re-derived by `npm run verify`.
 *
 * Asr is the exception and is deliberately NOT fitted per city. Awqaf rounds it
 * up rather than to nearest (see `rounding` on the method), but on top of that
 * their Asr drifts against the standard shadow rule over the year in a way no
 * constant can absorb: a per-city constant fitted on January–August scored
 * 81.5% there and collapsed to 43.6% on September, while one tuned for
 * September did the reverse. Every candidate stays inside a minute, so 0.2 is
 * the value that is least bad in both halves of the year rather than excellent
 * in one. The seasonal term is unexplained; do not fit a curve to it without
 * held-out months to test on.
 */

export interface Station {
  city: string;
  latitude: number;
  longitude: number;
  /** Minutes added to the raw calculation, fractional on purpose. */
  offsets: Record<PrayerKey, number>;
}

/** Beyond this from any published city, the general UAE offsets are used. */
export const MAX_DISTANCE_KM = 75;

export const UAE_STATIONS: Station[] = [
  {
    city: 'Dubai',
    latitude: 25.2048,
    longitude: 55.2708,
    offsets: { fajr: -0.11, sunrise: -3.32, dhuhr: 2.76, asr: 0.2, maghrib: 3, isha: -0.16 },
  },
  {
    city: 'Abu Dhabi',
    latitude: 24.4539,
    longitude: 54.3773,
    offsets: { fajr: -0.16, sunrise: -3.37, dhuhr: 2.31, asr: 0.2, maghrib: 2.6, isha: -0.61 },
  },
  {
    city: 'Sharjah',
    latitude: 25.3463,
    longitude: 55.4209,
    offsets: { fajr: 0.19, sunrise: -3.17, dhuhr: 2.26, asr: 0.2, maghrib: 2.6, isha: -0.66 },
  },
  {
    city: 'Ajman',
    latitude: 25.4052,
    longitude: 55.5136,
    offsets: { fajr: 0.49, sunrise: -2.72, dhuhr: 2.31, asr: 0.2, maghrib: 2.6, isha: -0.71 },
  },
  {
    city: 'Fujairah',
    latitude: 25.1288,
    longitude: 56.3265,
    offsets: { fajr: 0.79, sunrise: -2.62, dhuhr: 2.41, asr: 0.2, maghrib: 2.8, isha: -0.56 },
  },
  {
    city: 'Ras Al Khaimah',
    latitude: 25.7895,
    longitude: 55.9432,
    offsets: { fajr: 0.34, sunrise: -3.02, dhuhr: 2.21, asr: 0.2, maghrib: 2.5, isha: -0.81 },
  },
  {
    city: 'Umm Al Quwain',
    latitude: 25.5647,
    longitude: 55.5552,
    offsets: { fajr: 0.09, sunrise: -3.22, dhuhr: 2.06, asr: 0.2, maghrib: 2.4, isha: -0.96 },
  },
  {
    city: 'Al Ain',
    latitude: 24.1917,
    longitude: 55.7606,
    offsets: { fajr: -0.31, sunrise: -3.32, dhuhr: 2.91, asr: 0.2, maghrib: 2.45, isha: -0.16 },
  },
];

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** The published city whose table this location should follow, if any. */
export function nearestStation(latitude: number, longitude: number): Station | null {
  let best: Station | null = null;
  let bestDistance = Infinity;
  for (const station of UAE_STATIONS) {
    const distance = distanceKm(latitude, longitude, station.latitude, station.longitude);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = station;
    }
  }
  return bestDistance <= MAX_DISTANCE_KM ? best : null;
}
