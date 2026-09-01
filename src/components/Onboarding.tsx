import { useState } from 'react';
import { Sky } from './Sky';
import { LocationSheet } from './LocationSheet';
import { locateMe } from '../lib/geo';
import { useStore } from '../lib/store';
import { PrivacySheet } from './PrivacySheet';

export function Onboarding() {
  const setPlace = useStore((s) => s.setPlace);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  const locate = async () => {
    setBusy(true);
    setError(null);
    try {
      setPlace(await locateMe());
    } catch (e) {
      const denied = (e as GeolocationPositionError).code === 1;
      setError(
        denied
          ? 'Location is blocked for this site. Search for your city instead — it is just as accurate.'
          : 'Could not get a fix. Search for your city instead.',
      );
      setSearchOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sky relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      <Sky latitude={25.2048} longitude={55.2708} />
      <div className="relative z-10 w-full max-w-sm text-center">
        <p className="arabic text-3xl text-[var(--accent)]">مواقيت الصلاة</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Miqāt</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-dim)]">
          Prayer times worked out from the sun over your exact coordinates, matched to the
          timetable your mosque follows. No account, no ads, nothing tracked.
        </p>

        <button
          onClick={locate}
          disabled={busy}
          className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--accent)] px-5 py-3.5 text-sm font-semibold text-[var(--on-accent)] transition hover:brightness-110 disabled:opacity-70"
        >
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="2.8" fill="currentColor" />
            <circle cx="10" cy="10" r="6.4" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10 1.2v2.3M10 16.5v2.3M1.2 10h2.3M16.5 10h2.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {busy ? 'Finding you…' : 'Use my location'}
        </button>

        <button
          onClick={() => setSearchOpen(true)}
          className="mt-3 w-full rounded-2xl border border-[var(--card-line)] px-5 py-3 text-sm text-[var(--ink-dim)] transition hover:bg-white/5 hover:text-[var(--ink)]"
        >
          Search for a city
        </button>

        {error && <p className="mt-4 text-sm leading-relaxed text-[var(--accent)]">{error}</p>}

        <p className="mt-8 text-xs leading-relaxed text-[var(--ink-faint)]">
          Your coordinates are used on this device to work out the times. The app also records an
          anonymous visit count and the town it resolved. Sharing your exact position with the
          app's owner is a separate switch in Settings, off unless you turn it on.{' '}
          <button
            onClick={() => setPolicyOpen(true)}
            className="text-[var(--ink-dim)] underline underline-offset-4"
          >
            Privacy policy
          </button>
        </p>
      </div>
      <LocationSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
      <PrivacySheet open={policyOpen} onClose={() => setPolicyOpen(false)} />
    </div>
  );
}
