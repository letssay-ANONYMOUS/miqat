import { useEffect, useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { locateMe, searchPlaces, type Place } from '../lib/geo';
import { UAE_EMIRATES, UAE_PLACES, uaePlaceToPlace } from '../lib/uaePlaces';
import { useStore } from '../lib/store';

export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setPlace = useStore((s) => s.setPlace);
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
        setResults(await searchPlaces(query, controller.signal));
        setError(null);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError('City search is unreachable right now.');
      } finally {
        setBusy((b) => (b === 'search' ? null : b));
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [query]);

  const choose = (place: Place) => {
    setPlace(place);
    onClose();
  };

  const useGps = async () => {
    setBusy('gps');
    setError(null);
    try {
      choose(await locateMe());
    } catch (e) {
      const message = (e as GeolocationPositionError).code
        ? 'Location permission was denied. Search for your city instead.'
        : (e as Error).message;
      setError(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet
      open={open}
      title="Location"
      subtitle="Prayer times are computed from coordinates, so a precise spot matters."
      onClose={onClose}
    >
      <button
        onClick={useGps}
        disabled={busy === 'gps'}
        className="flex w-full items-center gap-3 rounded-2xl border border-[var(--card-line)] bg-white/5 px-4 py-3.5 text-left transition hover:bg-white/10 disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="3" fill="currentColor" />
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 1v2.2M10 16.8V19M1 10h2.2M16.8 10H19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="flex-1">
          <span className="block text-sm font-medium">
            {busy === 'gps' ? 'Getting a fix…' : 'Use my exact location'}
          </span>
          <span className="block text-xs text-[var(--ink-dim)]">GPS, accurate to a few metres</span>
        </span>
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-[var(--ink-faint)]">
        <span className="h-px flex-1 bg-[var(--card-line)]" />
        or search
        <span className="h-px flex-1 bg-[var(--card-line)]" />
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="City name — e.g. Al Ain, Istanbul, Toronto"
        className="w-full rounded-xl border border-[var(--card-line)] bg-black/25 px-4 py-3 text-sm outline-none transition placeholder:text-[var(--ink-faint)] focus:border-[var(--accent-soft)]"
      />

      {error && <p className="mt-3 text-sm text-[var(--accent)]">{error}</p>}

      {query.trim().length < 2 && (
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-wider text-[var(--ink-faint)]">
            United Arab Emirates
          </p>
          <div className="mt-3 space-y-4">
            {UAE_EMIRATES.map((emirate) => {
              const towns = UAE_PLACES.filter((p) => p.emirate === emirate);
              return (
                <div key={emirate}>
                  <p className="text-xs text-[var(--ink-dim)]">{emirate}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {towns.map((town) => (
                      <button
                        key={town.name}
                        onClick={() => choose(uaePlaceToPlace(town))}
                        className="rounded-full border border-[var(--card-line)] px-3.5 py-2 text-[13px] transition active:bg-white/10"
                      >
                        {town.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-[var(--ink-faint)]">
            Anywhere else in the world, type it above — the times are computed from coordinates, so
            every town works, not just the ones listed.
          </p>
        </div>
      )}

      <ul className="mt-3 space-y-1">
        {results.map((place) => (
          <li key={`${place.latitude},${place.longitude}`}>
            <button
              onClick={() => choose(place)}
              className="w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-white/8"
            >
              <span className="block text-sm font-medium">{place.name}</span>
              <span className="block text-xs text-[var(--ink-dim)]">
                {[place.admin, place.country].filter(Boolean).join(' · ')} · {place.timezone}
                {place.elevation > 0 && ` · ${Math.round(place.elevation)} m`}
              </span>
            </button>
          </li>
        ))}
        {busy === 'search' && results.length === 0 && (
          <li className="px-3 py-2 text-sm text-[var(--ink-faint)]">Searching…</li>
        )}
      </ul>
    </Sheet>
  );
}
