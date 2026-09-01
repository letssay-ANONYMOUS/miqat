import { FEED_SOURCE, STATIONS, fetchMonth, toMinutes } from '../src/lib/awqafFeed';
import { DEFAULT_SETTINGS, PRAYER_ORDER, computeDay, type PrayerKey } from '../src/lib/prayer';
import timetable from '../src/data/uae-timetable.json';

export const config = { maxDuration: 60 };

/**
 * The standing accuracy watch.
 *
 * Once a day this recomputes the whole current month for all eight stations
 * Awqaf publishes and diffs it against the published table, so a drift is
 * caught by a machine on the day it appears rather than by someone noticing
 * their sunrise looks wrong. Cron hits it with the secret; anyone may read the
 * last result, which is only a set of accuracy statistics.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SERVER_SECRET = process.env.MIQAT_SERVER_SECRET ?? '';
const CRON_SECRET = process.env.CRON_SECRET ?? '';
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK_URL ?? '';

/** Matches the bar `npm run verify` holds the engine to. */
const TOLERANCE_MINUTES = 3;
const REQUIRED_WITHIN_ONE_MINUTE = 0.99;

async function rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${name} returned ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Fires only on a failed audit. Shaped so a Slack or Discord incoming webhook
 * renders it as-is, and any other endpoint still gets the full JSON.
 */
async function alert(summary: Awaited<ReturnType<typeof runAudit>>): Promise<string | null> {
  if (!ALERT_WEBHOOK) return 'no webhook configured';
  const worst = summary.worstStation
    ? `${summary.worstStation} ${summary.worstPrayer} is ${summary.worstDelta} min out`
    : 'no stations could be read';
  const text =
    `Miqāt accuracy alert — prayer times no longer match the published Awqaf table.\n` +
    `${worst}. ${(summary.withinOneMinute * 100).toFixed(1)}% of ${summary.comparisons} ` +
    `checks were within a minute (needs ${REQUIRED_WITHIN_ONE_MINUTE * 100}%).\n` +
    `https://miqat-sepia.vercel.app/api/audit`;
  try {
    const response = await fetch(ALERT_WEBHOOK, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, content: text, summary }),
    });
    return response.ok ? 'sent' : `webhook returned ${response.status}`;
  } catch (error) {
    return `webhook failed: ${(error as Error).message}`;
  }
}

interface StationReport {
  city: string;
  days: number;
  worst: number;
  withinOneMinute: number;
}

/**
 * Has Awqaf published dates the shipped table does not carry yet?
 *
 * This is the signal that matters now: the app shows their table where it has
 * one, so the job is no longer to detect drift but to notice when there is more
 * table to fetch. It reports; it never rewrites what users see on its own. A
 * feed that has been caught serving filler does not get to update prayer times
 * unattended.
 */
async function coverage(year: number) {
  const shipped = timetable.cities as Record<string, Record<string, number[]>>;
  let have = 0;
  let fresh = 0;
  const months = new Set<number>();

  for (const station of STATIONS) {
    const rows = shipped[station.city] ?? {};
    have += Object.keys(rows).length;
    for (let month = 1; month <= 12; month += 1) {
      const known = Object.keys(rows).filter((k) => k.startsWith(`${month}-`)).length;
      // Only look where the shipped table is thin; a full month needs no check.
      if (known >= 28) continue;
      const result = await fetchMonth(station, year, month).catch(() => null);
      if (!result) continue;
      const extra = result.days.filter((d) => !rows[`${month}-${d.day}`]).length;
      if (extra > 0) {
        fresh += extra;
        months.add(month);
      }
    }
  }

  return { shippedDays: have, newDays: fresh, newMonths: [...months].sort((a, b) => a - b) };
}

async function runAudit() {
  const now = new Date();
  // Anchor on the UAE calendar, not the server's.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);

  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const notes: string[] = [];
  const reports: StationReport[] = [];
  let comparisons = 0;
  let within = 0;
  let worstDelta = 0;
  let worstStation: string | null = null;
  let worstPrayer: string | null = null;
  let worstDay: number | null = null;

  const months = await Promise.all(
    STATIONS.map((station) =>
      fetchMonth(station, year, month).catch((error: Error) => ({
        station,
        days: [],
        notes: [`${station.city}: ${error.message}`],
      })),
    ),
  );

  for (const result of months) {
    notes.push(...result.notes);
    if (result.days.length === 0) continue;

    const settings = {
      ...DEFAULT_SETTINGS,
      method: 'Dubai' as const,
      elevation: result.station.elevation,
    };
    let stationWorst = 0;
    let stationWithin = 0;
    let stationChecks = 0;

    for (const row of result.days) {
      const day = computeDay(
        result.station.latitude,
        result.station.longitude,
        new Date(year, month - 1, row.day, 12),
        settings,
      );
      for (const key of PRAYER_ORDER) {
        const delta =
          toMinutes(format.format(day.times[key])) - toMinutes(row[key as PrayerKey]);
        const size = Math.abs(delta);
        stationChecks += 1;
        comparisons += 1;
        if (size <= 1) {
          stationWithin += 1;
          within += 1;
        }
        if (size > stationWorst) stationWorst = size;
        if (size > worstDelta) {
          worstDelta = size;
          worstStation = result.station.city;
          worstPrayer = key;
          worstDay = row.day;
        }
      }
    }

    reports.push({
      city: result.station.city,
      days: result.days.length,
      worst: stationWorst,
      withinOneMinute: stationChecks ? stationWithin / stationChecks : 0,
    });
  }

  const published = await coverage(year);
  if (published.newDays > 0) {
    notes.push(
      `Awqaf has published ${published.newDays} day(s) the shipped timetable does not carry ` +
        `(month${published.newMonths.length > 1 ? 's' : ''} ${published.newMonths.join(', ')}). ` +
        `Run: npm --prefix miqat run build:timetable`,
    );
  }

  const withinOneMinute = comparisons ? within / comparisons : 0;
  // No usable stations is a failure of the watch, not a pass.
  const ok =
    comparisons > 0 && worstDelta <= TOLERANCE_MINUTES && withinOneMinute >= REQUIRED_WITHIN_ONE_MINUTE;

  return {
    source: FEED_SOURCE,
    year,
    month,
    stations: reports.length,
    comparisons,
    withinOneMinute: Number(withinOneMinute.toFixed(4)),
    worstDelta,
    worstStation,
    worstPrayer,
    worstDay,
    ok,
    notes: notes.slice(0, 40),
    detail: { stations: reports, timetable: published },
  };
}

/**
 * Node runtime, not edge: this does eight network round trips and a month of
 * astronomy, so it wants the longer budget. That means the Node
 * (request, response) signature rather than the Web one the other routes use.
 */
interface NodeRequest {
  headers: Record<string, string | string[] | undefined>;
}

interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

export default async function handler(request: NodeRequest, response: NodeResponse): Promise<void> {
  const send = (body: unknown, status = 200) => {
    response.statusCode = status;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body, null, 2));
  };

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVER_SECRET) {
    send({ error: 'audit is not configured' }, 503);
    return;
  }

  const header = request.headers.authorization;
  const presented = Array.isArray(header) ? header[0] : header;
  const authorised = CRON_SECRET.length > 0 && presented === `Bearer ${CRON_SECRET}`;

  if (!authorised) {
    // Public read of the last result — accuracy statistics, nothing personal.
    try {
      const latest = await rpc('miqat_latest_audit', { p_secret: SERVER_SECRET });
      send(latest ?? { status: 'no audit has run yet' });
    } catch (error) {
      send({ error: (error as Error).message }, 502);
    }
    return;
  }

  try {
    const summary = await runAudit();
    await rpc('miqat_record_audit', { p_secret: SERVER_SECRET, p_payload: summary });
    const alerted = summary.ok ? null : await alert(summary);
    send({ ...summary, alerted }, summary.ok ? 200 : 500);
  } catch (error) {
    send({ error: (error as Error).message }, 502);
  }
}
