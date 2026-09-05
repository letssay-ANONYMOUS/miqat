import { useEffect, useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { locateMe, searchPlaces, type Place } from '../lib/geo';
import { UAE_EMIRATES, UAE_EMIRATE_AR, UAE_PLACES, uaePlaceToPlace } from '../lib/uaePlaces';
import { useStore } from '../lib/store';
import { useI18n } from '../lib/i18n';

export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setPlace = useStore((s) => s.setPlace);
  const { language, isArabic, text } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState<'gps' | 'search' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setBusy('search');
      try {
        setResults(await searchPlaces(query, controller.signal, language));
        setError(null);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError(text('City search is unreachable right now.', 'تعذر الوصول إلى خدمة البحث عن المدن الآن.'));
      } finally {
        setBusy((b) => (b === 'search' ? null : b));
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [query, language]);

  const choose = (place: Place) => {
    setPlace(place);
    onClose();
  };

  const useGps = async () => {
    setBusy('gps');
    setError(null);
    try {
      choose(await locateMe(language));
    } catch (e) {
      const message = (e as GeolocationPositionError).code
        ? text('Location permission was denied. Search for your city instead.', 'تم رفض إذن الموقع. ابحث عن مدينتك بدلًا من ذلك.')
        : (e as Error).message;
      setError(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet
      open={open}
      title={text('Location', 'الموقع')}
      subtitle={text('Prayer times are computed from coordinates, so a precise spot matters.', 'تُحسب مواقيت الصلاة من الإحداثيات، لذلك يفيد تحديد الموقع بدقة.')}
      onClose={onClose}
    >
      <button
        onClick={useGps}
        disabled={busy === 'gps'}
        className="flex w-full items-center gap-3 rounded-2xl border border-[var(--card-line)] bg-white/5 px-4 py-3.5 text-start transition hover:bg-white/10 disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="3" fill="currentColor" />
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 1v2.2M10 16.8V19M1 10h2.2M16.8 10H19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="flex-1">
          <span className="block text-sm font-medium">
            {busy === 'gps' ? text('Getting a fix…', 'جارٍ تحديد الموقع…') : text('Use my exact location', 'استخدم موقعي الدقيق')}
          </span>
          <span className="block text-xs text-[var(--ink-dim)]">{text('GPS, accurate to a few metres', 'تحديد عبر GPS بدقة بضعة أمتار')}</span>
        </span>
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-[var(--ink-faint)]">
        <span className="h-px flex-1 bg-[var(--card-line)]" />
        {text('or search', 'أو ابحث')}
        <span className="h-px flex-1 bg-[var(--card-line)]" />
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={text('City name — e.g. Al Ain, Istanbul, Toronto', 'اسم المدينة — مثل العين أو إسطنبول أو تورونتو')}
        className="w-full rounded-xl border border-[var(--card-line)] bg-black/25 px-4 py-3 text-sm outline-none transition placeholder:text-[var(--ink-faint)] focus:border-[var(--accent-soft)]"
      />

      {error && <p className="mt-3 text-sm text-[var(--accent)]">{error}</p>}

      {query.trim().length < 2 && (
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-wider text-[var(--ink-faint)]">
            {text('United Arab Emirates', 'الإمارات العربية المتحدة')}
          </p>
          <div className="mt-3 space-y-4">
            {UAE_EMIRATES.map((emirate) => {
              const towns = UAE_PLACES.filter((p) => p.emirate === emirate);
              return (
                <div key={emirate}>
                  <p className="text-xs text-[var(--ink-dim)]">{isArabic ? UAE_EMIRATE_AR[emirate] : emirate}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {towns.map((town) => (
                      <button
                        key={town.name}
                        onClick={() => choose(uaePlaceToPlace(town, language))}
                        className="rounded-full border border-[var(--card-line)] px-3.5 py-2 text-[13px] transition active:bg-white/10"
                      >
                        {isArabic ? uaePlaceToPlace(town, 'ar').name : town.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-[var(--ink-faint)]">
            {text(
              'Anywhere else in the world, type it above — the times are computed from coordinates, so every town works, not just the ones listed.',
              'لأي مكان آخر في العالم، اكتب اسم المدينة أعلاه. تُحسب المواقيت من الإحداثيات، لذلك تعمل الخدمة مع كل المدن وليست المدن المدرجة فقط.',
            )}
          </p>
        </div>
      )}

      <ul className="mt-3 space-y-1">
        {results.map((place) => (
          <li key={`${place.latitude},${place.longitude}`}>
            <button
              onClick={() => choose(place)}
              className="w-full rounded-xl px-3 py-2.5 text-start transition hover:bg-white/8"
            >
              <span className="block text-sm font-medium">{place.name}</span>
              <span className="block text-xs text-[var(--ink-dim)]">
                {[place.admin, place.country].filter(Boolean).join(' · ')} · {place.timezone}
                {place.elevation > 0 && ` · ${Math.round(place.elevation)} ${text('m', 'م')}`}
              </span>
            </button>
          </li>
        ))}
        {busy === 'search' && results.length === 0 && (
          <li className="px-3 py-2 text-sm text-[var(--ink-faint)]">{text('Searching…', 'جارٍ البحث…')}</li>
        )}
      </ul>
    </Sheet>
  );
}
