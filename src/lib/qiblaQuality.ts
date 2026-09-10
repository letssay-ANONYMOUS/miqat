import type { Reading } from './heading';

export interface QiblaFix { latitude: number; longitude: number; accuracy: number; timestamp: number }
export type QiblaIssue = 'location' | 'location-stale' | 'location-poor' | 'near-kaaba' | 'portrait' | 'waiting' | 'stale' | 'relative' | 'flat' | 'sensor-poor' | 'model';

export function distanceMeters(
  latitude: number,
  longitude: number,
  targetLatitude: number,
  targetLongitude: number,
): number {
  const rad = Math.PI / 180;
  const a = Math.sin((targetLatitude - latitude) * rad / 2) ** 2 +
    Math.cos(latitude * rad) * Math.cos(targetLatitude * rad) *
      Math.sin((targetLongitude - longitude) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function kaabaDistance(latitude: number, longitude: number): number {
  return distanceMeters(latitude, longitude, 21.4225241, 39.8261818);
}

export function qiblaIssue(fix: QiblaFix | null, sample: Reading | null, age: number, angle: number, correction: number | null, now = Date.now()): QiblaIssue | null {
  if (!fix) return 'location';
  if (![fix.latitude, fix.longitude, fix.accuracy, fix.timestamp].every(Number.isFinite) || Math.abs(fix.latitude) > 90 || Math.abs(fix.longitude) > 180 || fix.accuracy < 0) return 'location-poor';
  // A stationary watch may not emit every minute. Five minutes remains tight
  // enough to catch travel while avoiding false expiry for a phone at rest.
  if (now - fix.timestamp > 5 * 60000 || fix.timestamp > now + 5000) return 'location-stale';
  const distance = kaabaDistance(fix.latitude, fix.longitude);
  if (distance < Math.max(50, fix.accuracy * 10)) return 'near-kaaba';
  if (fix.accuracy > 100 || Math.atan2(fix.accuracy, distance) * 180 / Math.PI > 1) return 'location-poor';
  if (angle !== 0) return 'portrait';
  if (!sample) return 'waiting';
  if (age > 1500) return 'stale';
  if (sample.reference === 'unusable' || !Number.isFinite(sample.degrees)) return 'relative';
  if (sample.level < Math.cos(25 * Math.PI / 180)) return 'flat';
  if (sample.accuracy !== null && (!Number.isFinite(sample.accuracy) || sample.accuracy < 0 || sample.accuracy > 10)) return 'sensor-poor';
  if (correction === null || !Number.isFinite(correction)) return 'model';
  return null;
}
