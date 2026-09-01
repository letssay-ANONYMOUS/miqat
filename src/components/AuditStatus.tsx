import { useEffect, useState } from 'react';
import { METHOD_BY_KEY } from '../lib/methods';
import { useStore } from '../lib/store';

interface Audit {
  ok: boolean;
  checked_at: string;
  comparisons: number;
  within_one_minute: number | string;
  worst_delta: number;
  worst_station: string | null;
  stations: number;
  year: number;
  month: number;
  status?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function ago(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${Math.round(hours)} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/**
 * The standing watch: a job re-checks the whole month against the published
 * Awqaf table every day, so drift is caught by a machine rather than by someone
 * noticing their sunrise looks wrong. This shows its last verdict.
 */
export function AuditStatus() {
  const method = METHOD_BY_KEY.get(useStore((state) => state.settings.method))!;
  const [audit, setAudit] = useState<Audit | null>(null);
  const [failed, setFailed] = useState(false);
  const relevant = Boolean(method.verifiedAgainst);

  useEffect(() => {
    if (!relevant) return;
    const controller = new AbortController();
    fetch('/api/audit', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setAudit)
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setFailed(true);
      });
    return () => controller.abort();
  }, [relevant]);

  if (!relevant || failed) return null;

  return (
    <>
      <h3 className="mb-3 text-[13px] font-semibold">Against the official timetable</h3>

      {!audit && <p className="text-sm text-[var(--ink-dim)]">Loading the last check…</p>}

      {audit?.status && (
        <p className="text-sm text-[var(--ink-dim)]">The daily check has not run yet.</p>
      )}

      {audit && !audit.status && (
        <div
          className={`rounded-2xl border px-4 py-3.5 ${
            audit.ok
              ? 'border-emerald-400/30 bg-emerald-400/10'
              : 'border-amber-400/30 bg-amber-400/10'
          }`}
        >
          <p className="text-sm font-medium">
            {Math.round(Number(audit.within_one_minute) * 1000) / 10}% of{' '}
            {audit.comparisons.toLocaleString()} published times matched within a minute
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--ink-dim)]">
            {MONTHS[audit.month - 1]} {audit.year} · {audit.stations} cities · worst gap{' '}
            {audit.worst_delta} min
            {audit.worst_station ? ` (${audit.worst_station})` : ''} · checked{' '}
            {ago(audit.checked_at)}
          </p>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-[var(--ink-faint)]">
        Awqaf publishes no API, so this reads the timetable a UAE newspaper republishes and
        recomputes the whole month against it, every day, for all eight cities Awqaf lists
        separately.
      </p>
    </>
  );
}
