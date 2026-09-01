import { useEffect, useRef, useState } from 'react';
import { readingFrom, relativeTurn, solarCalibration, type Reading } from '../lib/heading';
import { sunPosition } from '../lib/sun';
import { useStore } from '../lib/store';
import { haptic, hapticsAvailable } from '../lib/feel';

type PermissionCapableCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

type Status = 'idle' | 'live' | 'denied' | 'unsupported';

const CARDINALS = [
  { label: 'N', angle: 0 },
  { label: 'E', angle: 90 },
  { label: 'S', angle: 180 },
  { label: 'W', angle: 270 },
];

/**
 * The Qibla, at the size it deserves.
 *
 * The bearing is exact — a great-circle heading to the Kaaba, checked against an
 * independent implementation. Everything uncertain is the phone's magnetometer,
 * so the dial shows what it is actually working from: the needle fades when the
 * reading is unsteady, and the sun line, which needs no compass at all, is
 * always offered alongside it.
 */
export function QiblaCompass({ bearing }: { bearing: number }) {
  const place = useStore((state) => state.place);
  const qiblaOffset = useStore((state) => state.qiblaOffset);
  const setQiblaOffset = useStore((state) => state.setQiblaOffset);

  const [reading, setReading] = useState<Reading | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [now, setNow] = useState(() => new Date());
  const listening = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (status !== 'live' || listening.current) return;
    listening.current = true;
    const onOrientation = (event: Event) => {
      const next = readingFrom(event as DeviceOrientationEvent);
      if (next) setReading(next);
    };
    const name = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(name, onOrientation, true);
    return () => {
      window.removeEventListener(name, onOrientation, true);
      listening.current = false;
    };
  }, [status]);

  const enable = async () => {
    if (typeof DeviceOrientationEvent === 'undefined') return setStatus('unsupported');
    const ctor = DeviceOrientationEvent as PermissionCapableCtor;
    try {
      if (typeof ctor.requestPermission === 'function') {
        if ((await ctor.requestPermission()) !== 'granted') return setStatus('denied');
      }
      setStatus('live');
    } catch {
      setStatus('denied');
    }
  };

  const sun = place ? sunPosition(now, place.latitude, place.longitude) : null;
  const sunUp = sun !== null && sun.altitude > 1;
  const fromSun = sun ? relativeTurn(sun.azimuth, bearing) : null;

  const corrected =
    reading && reading.reference !== 'unusable' ? (reading.degrees + qiblaOffset + 360) % 360 : null;
  const live = corrected !== null;
  const shaky = reading !== null && (reading.level < 0.45 || (reading.accuracy ?? 0) < 0);
  const rotation = live ? bearing - corrected : bearing;
  const aligned = live && Math.abs(((rotation + 540) % 360) - 180) > 176;

  /*
   * Feedback as you turn: a light tick each time you cross a five-degree step
   * on the way in, and a firmer double pulse the moment you are on the Qibla —
   * so it can be found without watching the screen.
   */
  const lastStep = useRef<number | null>(null);
  const wasAligned = useRef(false);
  useEffect(() => {
    if (!live) return;
    const off = Math.abs(((rotation + 540) % 360) - 180);
    const away = 180 - off;

    if (aligned && !wasAligned.current) haptic('lock');
    wasAligned.current = aligned;

    if (!aligned && away < 40) {
      const step = Math.round(away / 5);
      if (lastStep.current !== null && step !== lastStep.current) haptic('tick');
      lastStep.current = step;
    } else {
      lastStep.current = null;
    }
  }, [rotation, live, aligned]);

  const calibrate = () => {
    if (reading && sun) setQiblaOffset(solarCalibration(sun.azimuth, reading.degrees));
  };

  return (
    <div className="flex flex-col items-center">
      <div className={`qibla-stage${aligned ? ' is-aligned' : ''}`}>
        <svg viewBox="0 0 400 400" className="qibla-face" aria-label={`Qibla ${bearing.toFixed(1)} degrees from true north`}>
          <defs>
            <radialGradient id="q-well" cx="42%" cy="34%" r="72%">
              <stop offset="0%" stopColor="var(--card)" stopOpacity="0.9" />
              <stop offset="70%" stopColor="var(--card)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--card)" stopOpacity="0.05" />
            </radialGradient>
            <linearGradient id="q-needle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-soft)" />
            </linearGradient>
            <radialGradient id="q-halo" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="var(--accent)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.16" />
            </radialGradient>
          </defs>

          <circle cx="200" cy="200" r="186" fill="url(#q-halo)" />
          <circle cx="200" cy="200" r="168" fill="url(#q-well)" stroke="var(--card-line)" strokeWidth="1" />
          <circle cx="200" cy="200" r="150" fill="none" stroke="var(--card-line)" strokeWidth="1" opacity="0.6" />

          {/* The rose turns with the phone; the Qibla marker rides on it. */}
          <g
            style={{
              transform: `rotate(${live ? -corrected! : 0}deg)`,
              transformOrigin: '200px 200px',
              transition: live ? 'transform .14s linear' : 'transform .7s cubic-bezier(.22,1,.36,1)',
            }}
          >
            {Array.from({ length: 72 }, (_, i) => {
              const major = i % 9 === 0;
              const mid = i % 3 === 0;
              return (
                <line
                  key={i}
                  x1="200"
                  y1={major ? 24 : mid ? 28 : 30}
                  x2="200"
                  y2={major ? 44 : mid ? 38 : 35}
                  stroke={major ? 'var(--ink-dim)' : 'var(--ink-faint)'}
                  strokeWidth={major ? 2.4 : mid ? 1.4 : 1}
                  strokeLinecap="round"
                  opacity={major ? 0.95 : mid ? 0.6 : 0.35}
                  transform={`rotate(${i * 5} 200 200)`}
                />
              );
            })}

            {CARDINALS.map(({ label, angle }) => (
              <g key={label} transform={`rotate(${angle} 200 200)`}>
                {/* Counter-rotated so the glyph itself is never on its side. */}
                <text
                  x="200"
                  y="68"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="18"
                  fontWeight="600"
                  fill={label === 'N' ? 'var(--accent)' : 'var(--ink-faint)'}
                  transform={`rotate(${-angle} 200 68)`}
                >
                  {label}
                </text>
              </g>
            ))}

            {/* Kaaba marker, sitting at the true bearing on the rose. */}
            <g transform={`rotate(${bearing} 200 200)`}>
              <g transform={`translate(200 104) rotate(${-bearing})`}>
                <circle r="17" fill="var(--accent)" opacity="0.16" />
                <rect x="-9" y="-10" width="18" height="20" rx="2" fill="var(--accent)" />
                <rect x="-9" y="-3" width="18" height="3.4" fill="var(--on-accent)" opacity="0.65" />
                <rect x="-9" y="-10" width="18" height="2.2" fill="#ffffff" opacity="0.35" />
              </g>
            </g>
          </g>

          {/* The needle is fixed to the screen: it points where you must turn. */}
          <g
            opacity={shaky ? 0.4 : 1}
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: '200px 200px',
              transition: live ? 'transform .14s linear' : 'transform .7s cubic-bezier(.22,1,.36,1)',
            }}
          >
            <path d="M200 74 L212 196 L200 186 L188 196 Z" fill="url(#q-needle)" />
            <path d="M200 74 L206 136 L200 130 L194 136 Z" fill="#ffffff" opacity="0.32" />
          </g>

          <circle cx="200" cy="200" r="9" fill="var(--accent)" />
          <circle cx="200" cy="200" r="3.5" fill="var(--on-accent)" opacity="0.7" />
        </svg>

        <div className="qibla-readout">
          <p className="tabular qibla-degrees">{bearing.toFixed(1)}°</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            from true north
          </p>
        </div>
      </div>

      <div className="mt-6 w-full max-w-sm space-y-3 text-center">
        {sunUp && fromSun && (
          <p className="text-sm leading-relaxed text-[var(--ink-dim)]">
            Face the sun, then turn{' '}
            <span className="font-semibold text-[var(--ink)]">
              {fromSun.degrees}° to your {fromSun.side}
            </span>
            . Exact — from the sun's position, no compass involved.
          </p>
        )}

        {status === 'idle' && (
          <button
            onClick={() => {
              haptic('soft');
              void enable();
            }}
            className="w-full rounded-2xl bg-[var(--accent)] px-5 py-3.5 text-sm font-semibold text-[var(--on-accent)] transition active:brightness-110"
          >
            Turn on the live compass
          </button>
        )}

        {status === 'live' && !reading && (
          <p className="text-sm text-[var(--ink-dim)]">Waiting for the compass…</p>
        )}

        {reading?.reference === 'unusable' && (
          <p className="text-sm leading-relaxed text-[var(--ink-dim)]">
            This browser reports orientation relative to however the phone was held when the page
            opened, not to the earth — it cannot be a compass. Use the sun instead.
          </p>
        )}

        {live && shaky && (
          <p className="text-sm text-[var(--ink-dim)]">
            Hold the phone flat, away from metal — the reading is unsteady.
          </p>
        )}

        {live && !hapticsAvailable && (
          <p className="text-xs leading-relaxed text-[var(--ink-faint)]">
            No buzz on this device — iPhones give web pages no way to trigger haptics. The dial
            still glows when you are on the Qibla.
          </p>
        )}

        {live && !shaky && (
          <p className="text-sm text-[var(--ink-dim)]">
            {reading?.reference === 'true'
              ? 'Live, referenced to true north.'
              : qiblaOffset !== 0
                ? 'Live, corrected against the sun.'
                : 'Live, from magnetic north — a couple of degrees off in the UAE, more elsewhere.'}
          </p>
        )}

        {live && sunUp && (
          <button
            onClick={calibrate}
            className="w-full rounded-2xl border border-[var(--card-line)] px-5 py-3 text-sm font-medium transition active:bg-white/10"
          >
            {qiblaOffset === 0
              ? 'Calibrate: aim the top of the phone at the sun, then tap'
              : 'Re-calibrate against the sun'}
          </button>
        )}

        {qiblaOffset !== 0 && (
          <button
            onClick={() => setQiblaOffset(0)}
            className="text-xs text-[var(--ink-dim)] underline underline-offset-4"
          >
            Clear the {qiblaOffset > 0 ? '+' : ''}
            {qiblaOffset.toFixed(1)}° correction
          </button>
        )}

        {status === 'denied' && (
          <p className="text-sm text-[var(--ink-dim)]">
            Motion access refused. The angle above is still exact, from true north.
          </p>
        )}
        {status === 'unsupported' && (
          <p className="text-sm text-[var(--ink-dim)]">
            No compass on this device. The angle above is from true north.
          </p>
        )}
      </div>
    </div>
  );
}
