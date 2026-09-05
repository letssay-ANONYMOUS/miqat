import { useEffect, useState } from 'react';
import { METHOD_BY_KEY } from '../lib/methods';
import { useStore } from '../lib/store';
import { useI18n } from '../lib/i18n';

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

function ago(iso: string, language: 'en' | 'ar'): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (language === 'ar') {
    if (hours < 1) return 'قبل أقل من ساعة';
    if (hours < 24) return `قبل ${Math.round(hours)} ساعة`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'أمس' : `قبل ${days} أيام`;
  }
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
  const { language, locale, text } = useI18n();

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
      <h3 className="mb-3 text-[13px] font-semibold">{text('Against the official timetable', 'المقارنة مع الجدول الرسمي')}</h3>

      {!audit && <p className="text-sm text-[var(--ink-dim)]">{text('Loading the last check…', 'جارٍ تحميل آخر فحص…')}</p>}

      {audit?.status && (
        <p className="text-sm text-[var(--ink-dim)]">{text('The daily check has not run yet.', 'لم يُجرَ الفحص اليومي بعد.')}</p>
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
            {text(
              `${Math.round(Number(audit.within_one_minute) * 1000) / 10}% of ${audit.comparisons.toLocaleString()} published times matched within a minute`,
              `تطابق ${Math.round(Number(audit.within_one_minute) * 1000) / 10}% من ${audit.comparisons.toLocaleString(locale)} موعدًا منشورًا ضمن دقيقة واحدة`,
            )}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--ink-dim)]">
            {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(audit.year, audit.month - 1, 1))} · {audit.stations} {text('cities', 'مدن')} · {text('worst gap', 'أكبر فرق')}{' '}
            {audit.worst_delta} {text('min', 'دقيقة')}
            {audit.worst_station ? ` (${audit.worst_station})` : ''} · {ago(audit.checked_at, language)}
          </p>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-[var(--ink-faint)]">
        {text('Awqaf publishes no API, so this reads the timetable a UAE newspaper republishes and recomputes the whole month against it, every day, for all eight cities Awqaf lists separately.', 'لا توفر الأوقاف واجهة برمجة، لذلك يقرأ التطبيق الجدول الذي تعيد صحيفة إماراتية نشره ويعيد حساب الشهر كاملًا ومقارنته يوميًا لجميع المدن الثماني التي تنشرها الأوقاف منفصلة.')}
      </p>
    </>
  );
}
