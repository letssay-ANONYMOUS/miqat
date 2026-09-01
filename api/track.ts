export const config = { runtime: 'edge' };

/**
 * The only write path into the database.
 *
 * The browser used to call Supabase directly with the publishable key, which
 * ships in the bundle — readable by anyone, so anyone could have written junk
 * rows. Now the key and the shared secret live only here, on the server, and
 * the database function refuses anything that arrives without the secret.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SERVER_SECRET = process.env.MIQAT_SERVER_SECRET ?? '';
const IP_SALT = process.env.MIQAT_IP_SALT ?? 'miqat';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Hashed, never stored raw — it exists only to rate-limit. */
async function clientHash(request: Request): Promise<string> {
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  if (!ip) return '';
  const bytes = new TextEncoder().encode(`${IP_SALT}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, max) : null;
}

function coordinate(value: unknown, limit: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit
    ? value
    : null;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVER_SECRET) {
    return new Response(null, { status: 204 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }

  const visitor = typeof body.visitor === 'string' ? body.visitor : '';
  if (!UUID.test(visitor)) {
    return new Response(null, { status: 400 });
  }

  const consent = body.consent === true;
  const payload = {
    p_secret: SERVER_SECRET,
    p_visitor: visitor,
    p_city: text(body.city, 120),
    p_region: text(body.region, 120),
    p_country: text(body.country, 120),
    p_country_code: text(body.countryCode, 8),
    p_timezone: text(body.timezone, 64),
    p_method: text(body.method, 40),
    p_language: text(body.language, 16),
    p_platform: text(body.platform, 16),
    p_installed: body.installed === true,
    p_consent: consent,
    p_policy_version: text(body.policyVersion, 32),
    // Coordinates are dropped outright unless consent came with the request.
    p_lat: consent ? coordinate(body.latitude, 90) : null,
    p_lon: consent ? coordinate(body.longitude, 180) : null,
    p_accuracy: coordinate(body.accuracy, 100000),
    p_source: text(body.source, 16),
    p_client_hash: await clientHash(request),
  };

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/miqat_track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Reporting is never allowed to surface as an error in the app.
  }

  return new Response(null, { status: 204 });
}
