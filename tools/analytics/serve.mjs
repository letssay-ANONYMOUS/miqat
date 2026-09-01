import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The analytics dashboard, on this machine only.
 *
 * No Miqāt account, no hosted admin page, nothing exposed to the internet: the
 * server binds to the loopback address, the credentials live in a 0600 file in
 * your home directory, and the secret is never handed to the browser — the page
 * asks this process, and this process asks the database.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(homedir(), '.miqat', 'config.json');
const PORT = Number(process.env.MIQAT_ANALYTICS_PORT ?? 7823);

let config;
try {
  config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
} catch {
  console.error(`\nNo config at ${CONFIG_PATH}.\n\nCreate it as:\n`);
  console.error('  { "url": "https://<ref>.supabase.co", "key": "<publishable key>", "secret": "<server secret>" }\n');
  process.exit(1);
}

async function fetchAnalytics(days) {
  const response = await fetch(`${config.url}/rest/v1/rpc/miqat_analytics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
    body: JSON.stringify({ p_secret: config.secret, p_days: days }),
  });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  const data = await response.json();
  if (data === null) throw new Error('The secret in your config was rejected.');
  return data;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);

  try {
    if (url.pathname === '/data') {
      const days = Number(url.searchParams.get('days') ?? 90);
      const data = await fetchAnalytics(Number.isFinite(days) ? days : 90);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(data));
      return;
    }

    const page = await readFile(join(HERE, 'dashboard.html'), 'utf8');
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(page);
  } catch (error) {
    response.writeHead(500, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: error.message }));
  }
});

// Loopback only. Binding to 0.0.0.0 would put visitor coordinates on the network.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Miqāt analytics  →  http://127.0.0.1:${PORT}\n`);
  console.log(`  reading ${CONFIG_PATH}`);
  console.log('  this machine only — press Ctrl+C to stop\n');
});
