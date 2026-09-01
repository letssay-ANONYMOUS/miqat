import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { verifyAgainstAladhan, type VerifyResult } from '../lib/verify';
import { PRAYER_META } from '../lib/prayer';
import { useStore } from '../lib/store';
import { AuditStatus } from './AuditStatus';
import { VerificationNote } from './VerificationNote';

export function VerifySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { place, settings } = useStore();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A method whose offsets deliberately depart from AlAdhan's is not "wrong".
  const expected = Boolean(result?.note);

  useEffect(() => {
    if (!open || !place) return;
    const controller = new AbortController();
    setBusy(true);
    setError(null);
    verifyAgainstAladhan(
      place.latitude,
      place.longitude,
      place.timezone,
      settings,
      controller.signal,
    )
      .then(setResult)
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => setBusy(false));
    return () => controller.abort();
    // Re-runs when the sheet opens or the parameters being checked change.
  }, [open, place, settings]);

  return (
    <Sheet
      open={open}
      title="Accuracy"
      subtitle="How these times compare with the authority and with a second implementation." 
      onClose={onClose}
    >
      <VerificationNote />

      <AuditStatus />

      <h3 className="mb-3 mt-6 text-[13px] font-semibold">Live check, right now</h3>

      {busy && <p className="text-sm text-[var(--ink-dim)]">Asking AlAdhan…</p>}
      {error && (
        <p className="text-sm text-[var(--accent)]">
          {error} Your times are still correct — they are computed on this device and never depend
          on the network.
        </p>
      )}

      {result && (
        <>
          <div
            className={`rounded-2xl border px-4 py-3.5 ${
              result.ok || expected
                ? 'border-emerald-400/30 bg-emerald-400/10'
                : 'border-amber-400/30 bg-amber-400/10'
            }`}
          >
            <p className="text-sm font-medium">
              {result.ok
                ? 'Both implementations agree.'
                : expected
                  ? `Differs by up to ${result.maxDelta} min, as expected for this method.`
                  : `Largest difference: ${result.maxDelta} min.`}
            </p>
            <p className="mt-0.5 text-xs text-[var(--ink-dim)]">
              {result.methodLabel} · checked{' '}
              {result.checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <table className="mt-5 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[var(--ink-faint)]">
                <th className="pb-2 font-medium">Prayer</th>
                <th className="pb-2 text-right font-medium">This app</th>
                <th className="pb-2 text-right font-medium">AlAdhan</th>
                <th className="pb-2 text-right font-medium">Δ</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {result.rows.map((row) => (
                <tr key={row.key} className="border-t border-[var(--card-line)]">
                  <td className="py-2.5">{PRAYER_META[row.key].en}</td>
                  <td className="py-2.5 text-right">{row.local}</td>
                  <td className="py-2.5 text-right text-[var(--ink-dim)]">{row.remote}</td>
                  <td
                    className={`py-2.5 text-right ${
                      row.deltaMinutes === 0 ? 'text-[var(--ink-faint)]' : 'text-[var(--accent)]'
                    }`}
                  >
                    {row.deltaMinutes === 0
                      ? '—'
                      : `${row.deltaMinutes > 0 ? '+' : ''}${row.deltaMinutes}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-5 text-xs leading-relaxed text-[var(--ink-faint)]">
            {result.note ? `${result.note} ` : ''}
            Manual corrections are also excluded, so this compares the calculation itself. A
            difference of one minute is normal rounding; anything larger means the two sides disagree
            on a parameter.
          </p>
        </>
      )}
    </Sheet>
  );
}
