import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { verifyAgainstAladhan, type VerifyResult } from '../lib/verify';
import { PRAYER_META } from '../lib/prayer';
import { useStore } from '../lib/store';
import { AuditStatus } from './AuditStatus';
import { VerificationNote } from './VerificationNote';
import { useI18n } from '../lib/i18n';

export function VerifySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { place, settings } = useStore();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A method whose offsets deliberately depart from AlAdhan's is not "wrong".
  const expected = Boolean(result?.note);
  const { locale, isArabic, text } = useI18n();

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
      title={text('Accuracy', 'الدقة')}
      subtitle={text('How these times compare with the authority and with a second implementation.', 'مقارنة هذه المواقيت مع الجهة الرسمية ومع تطبيق حسابي مستقل.')}
      onClose={onClose}
    >
      <VerificationNote />

      <AuditStatus />

      <h3 className="mb-3 mt-6 text-[13px] font-semibold">{text('Live check, right now', 'فحص مباشر الآن')}</h3>

      {busy && <p className="text-sm text-[var(--ink-dim)]">{text('Asking AlAdhan…', 'جارٍ الاستعلام من AlAdhan…')}</p>}
      {error && (
        <p className="text-sm text-[var(--accent)]">
          {error} {text('Your times are still correct — they are computed on this device and never depend on the network.', 'تظل مواقيتك صحيحة؛ فهي تُحسب على هذا الجهاز ولا تعتمد على الشبكة.')}
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
                ? text('Both implementations agree.', 'تتطابق نتيجتا الحساب.')
                : expected
                  ? text(`Differs by up to ${result.maxDelta} min, as expected for this method.`, `يوجد فرق يصل إلى ${result.maxDelta} دقيقة، وهو متوقع لهذه الطريقة.`)
                  : text(`Largest difference: ${result.maxDelta} min.`, `أكبر فرق: ${result.maxDelta} دقيقة.`)}
            </p>
            <p className="mt-0.5 text-xs text-[var(--ink-dim)]">
              {result.methodLabel} · {text('checked', 'تم الفحص')}{' '}
              {result.checkedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <table className="mt-5 w-full text-sm">
            <thead>
              <tr className="text-start text-xs uppercase tracking-wider text-[var(--ink-faint)]">
                <th className="pb-2 font-medium">{text('Prayer', 'الصلاة')}</th>
                <th className="pb-2 text-end font-medium">{text('This app', 'هذا التطبيق')}</th>
                <th className="pb-2 text-end font-medium">AlAdhan</th>
                <th className="pb-2 text-end font-medium">Δ</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {result.rows.map((row) => (
                <tr key={row.key} className="border-t border-[var(--card-line)]">
                  <td className="py-2.5">{isArabic ? PRAYER_META[row.key].ar : PRAYER_META[row.key].en}</td>
                  <td className="py-2.5 text-end">{row.local}</td>
                  <td className="py-2.5 text-end text-[var(--ink-dim)]">{row.remote}</td>
                  <td
                    className={`py-2.5 text-end ${
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
            {text('Manual corrections are also excluded, so this compares the calculation itself. A difference of one minute is normal rounding; anything larger means the two sides disagree on a parameter.', 'يستبعد الفحص أيضًا التصحيحات اليدوية، لذا فهو يقارن الحساب نفسه. فرق دقيقة واحدة طبيعي بسبب التقريب، وأي فرق أكبر يعني اختلافًا في أحد المعايير.')}
          </p>
        </>
      )}
    </Sheet>
  );
}
