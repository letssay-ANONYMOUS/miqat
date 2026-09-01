export const config = { runtime: 'edge' };

/** Erasure request. Deletes the visitor and everything cascading from them. */

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SERVER_SECRET = process.env.MIQAT_SERVER_SECRET ?? '';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVER_SECRET) {
    return new Response(null, { status: 204 });
  }

  let visitor = '';
  try {
    const body = (await request.json()) as { visitor?: unknown };
    visitor = typeof body.visitor === 'string' ? body.visitor : '';
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!UUID.test(visitor)) {
    return new Response(null, { status: 400 });
  }

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/miqat_forget`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_secret: SERVER_SECRET, p_visitor: visitor }),
    });
  } catch {
    return new Response(null, { status: 502 });
  }

  return new Response(null, { status: 204 });
}
