import type { Place } from './geo';

/**
 * Usage reporting for the app's owner.
 *
 * Two tiers, deliberately separated:
 *  - Always: a random id with no name attached, a visit count, and the town the
 *    app already resolved in order to do the maths. Ordinary analytics.
 *  - Only after an explicit, unticked-by-default opt-in: the precise coordinates
 *    and the time they were taken.
 *
 * Both go to this app's own /api/track, never straight to the database — the
 * browser holds no database key, so the write path cannot be abused by anyone
 * who reads the bundle. The consent rule is enforced twice more after that: the
 * server drops coordinates without consent, and so does the database function.
 *
 * Every call is fire-and-forget: if it fails the app is unaffected, because the
 * prayer times never needed the network in the first place.
 */

export const POLICY_VERSION = '2026-08-29';

const VISITOR_KEY = 'miqat.visitor';
const LAST_SENT_KEY = 'miqat.lastSent';

/** A random id kept in this browser. Never derived from anything personal. */
export function visitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function platform(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  return 'other';
}

function installed(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

async function post(path: string, body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Reporting must never affect the prayer times, which are local anyway.
  }
}

function describe(place: Place, method: string, consent: boolean) {
  return {
    visitor: visitorId(),
    city: place.name,
    region: place.admin ?? null,
    country: place.country || null,
    countryCode: place.countryCode || null,
    timezone: place.timezone,
    method,
    language: navigator.language,
    platform: platform(),
    installed: installed(),
    consent,
    policyVersion: POLICY_VERSION,
    latitude: consent ? place.latitude : null,
    longitude: consent ? place.longitude : null,
    source: place.source,
  };
}

export interface TrackInput {
  place: Place;
  method: string;
  /** True only when the user has ticked the precise-location box. */
  sharePreciseLocation: boolean;
}

/** Throttled to once every 30 minutes so a reloading tab is not a new visit. */
export async function track({ place, method, sharePreciseLocation }: TrackInput): Promise<void> {
  try {
    const last = Number(localStorage.getItem(LAST_SENT_KEY) ?? 0);
    if (Date.now() - last < 30 * 60_000) return;
    localStorage.setItem(LAST_SENT_KEY, String(Date.now()));
  } catch {
    // Storage unavailable — still worth sending once.
  }
  await post('/api/track', describe(place, method, sharePreciseLocation));
}

/** Applies a consent change at once, without waiting for the throttled send. */
export async function syncConsent(place: Place, method: string, consent: boolean): Promise<void> {
  await post('/api/track', describe(place, method, consent));
}

/** Deletes this browser's rows, pings included, and starts a fresh id. */
export async function forgetMe(): Promise<void> {
  await post('/api/forget', { visitor: visitorId() });
  try {
    localStorage.removeItem(VISITOR_KEY);
    localStorage.removeItem(LAST_SENT_KEY);
  } catch {
    // Nothing more to clear.
  }
}
