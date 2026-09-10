import { useMemo } from 'react';
import { CRATERS, moonPhase, terminator } from '../lib/moon';

/**
 * The sun and the moon, drawn rather than shaded.
 *
 * Both are SVG, which buys real detail for almost nothing: limb darkening on
 * the sun so it reads as a sphere of gas rather than a disc of paint, a single
 * static grain filter for granulation, and on the moon actual maria and craters
 * with the light falling across them from the correct side.
 *
 * Nothing animates per frame. The grain is rasterised once by the browser, the
 * craters never move, and the phase is recomputed twice an hour. This is why it
 * can look like this and still cost nothing to run.
 */

export function SunBody() {
  return (
    <svg viewBox="0 0 100 100" className="sun-body" aria-hidden="true">
      <defs>
        {/* Limb darkening: real stars are brighter at the centre of the disc,
            because you see deeper, hotter gas there. */}
        <radialGradient id="sun-disc" cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#fffdf6" />
          <stop offset="34%" stopColor="var(--sun-core)" />
          <stop offset="76%" stopColor="var(--sun-halo)" />
          <stop offset="100%" stopColor="var(--sun-halo)" stopOpacity="0.82" />
        </radialGradient>

        <radialGradient id="sun-rim" cx="50%" cy="50%" r="50%">
          <stop offset="82%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="96%" stopColor="var(--sun-core)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--sun-halo)" stopOpacity="0" />
        </radialGradient>

        {/* Granulation. Rendered once, then cached by the browser. */}
        <filter id="sun-grain" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" result="g" />
          <feComponentTransfer in="g" result="soft">
            <feFuncA type="linear" slope="0.5" intercept="-0.18" />
          </feComponentTransfer>
          <feComposite in="soft" in2="SourceGraphic" operator="in" />
        </filter>
      </defs>

      <circle cx="50" cy="50" r="50" fill="url(#sun-disc)" />
      <circle cx="50" cy="50" r="50" fill="#ffffff" opacity="0.5" filter="url(#sun-grain)" />
      <circle cx="50" cy="50" r="50" fill="url(#sun-rim)" />
      <ellipse cx="38" cy="31" rx="29" ry="23" fill="white" opacity="0.15" />
      <circle cx="50" cy="50" r="48.5" fill="none" stroke="var(--sun-core)" strokeWidth="1.1" opacity="0.6" />
    </svg>
  );
}

/** Optical layers stay outside the sphere so rays retain a soft tapered edge. */
export function SunOptics() {
  return <svg viewBox="0 0 400 400" className="sun-optics" aria-hidden="true">
    <defs>
      <radialGradient id="solar-scatter">
        <stop offset="0" stopColor="var(--sun-core)" stopOpacity="0.95" />
        <stop offset="0.17" stopColor="var(--sun-core)" stopOpacity="0.55" />
        <stop offset="0.4" stopColor="var(--sun-halo)" stopOpacity="0.13" />
        <stop offset="1" stopColor="var(--sun-halo)" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="solar-ray" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="var(--sun-core)" stopOpacity="0.65" />
        <stop offset="0.3" stopColor="var(--sun-core)" stopOpacity="0.35" />
        <stop offset="1" stopColor="var(--sun-core)" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="solar-glint">
        <stop offset="0" stopColor="white" stopOpacity="0.75" />
        <stop offset="0.4" stopColor="var(--sun-core)" stopOpacity="0.22" />
        <stop offset="1" stopColor="var(--sun-halo)" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="200" cy="200" r="198" fill="url(#solar-scatter)" />
    <g className="solar-rays">
      {Array.from({ length: 20 }, (_, i) => {
        const tip = 12 + ((i * 37) % 70);
        const width = i % 3 === 0 ? 9 : 3;
        return <path key={i} transform={`rotate(${i * 18 + 7} 200 200)`}
          d={`M${200 - width} 181 Q195 135 200 ${tip} Q205 135 ${200 + width} 181 Z`}
          fill="url(#solar-ray)" opacity={i % 3 === 0 ? 0.85 : 0.5} />;
      })}
    </g>
    <g className="solar-glints">
      <ellipse cx="200" cy="200" rx="182" ry="3" fill="url(#solar-glint)" transform="rotate(-14 200 200)" />
      <ellipse cx="200" cy="200" rx="2" ry="150" fill="url(#solar-glint)" transform="rotate(-14 200 200)" />
      <circle cx="249" cy="255" r="16" fill="url(#solar-glint)" opacity="0.24" />
      <circle cx="280" cy="289" r="24" fill="none" stroke="var(--sun-halo)" strokeWidth="0.7" opacity="0.08" />
    </g>
  </svg>;
}

export function MoonBody({ date }: { date: Date }) {
  const { phase, path } = useMemo(() => {
    const p = moonPhase(date);
    const { sweep, innerSweep, rx } = terminator(p);
    const d = `M 50 0 A 50 50 0 0 ${sweep} 50 100 A ${rx} 50 0 0 ${innerSweep} 50 0 Z`;
    return { phase: p, path: d };
  }, [date]);

  return (
    <svg viewBox="0 0 100 100" className="moon-body" aria-label={phase.name}>
      <defs>
        <radialGradient id="moon-surface" cx="38%" cy="34%" r="76%">
          <stop offset="0%" stopColor="#fdfcf8" />
          <stop offset="52%" stopColor="#e6e6e4" />
          <stop offset="86%" stopColor="#b9bcc4" />
          <stop offset="100%" stopColor="#8e94a3" />
        </radialGradient>

        <radialGradient id="crater-shade" cx="36%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#6f737f" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#8a8f9b" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.22" />
        </radialGradient>

        <clipPath id="moon-clip">
          <circle cx="50" cy="50" r="50" />
        </clipPath>

        {/* Only the lit portion is painted; the rest stays night sky. */}
        <clipPath id="moon-lit">
          <path d={path} />
        </clipPath>
      </defs>

      <g clipPath="url(#moon-lit)">
        <g clipPath="url(#moon-clip)">
          <circle cx="50" cy="50" r="50" fill="url(#moon-surface)" />

          {/* Maria — the dark basalt plains you can see with the naked eye. */}
          <ellipse cx="38" cy="34" rx="17" ry="13" fill="#9aa0ad" opacity="0.34" />
          <ellipse cx="60" cy="30" rx="11" ry="9" fill="#9aa0ad" opacity="0.26" />
          <ellipse cx="66" cy="52" rx="14" ry="16" fill="#9aa0ad" opacity="0.22" />
          <ellipse cx="34" cy="60" rx="10" ry="8" fill="#9aa0ad" opacity="0.2" />

          {CRATERS.map((crater, i) => (
            <g key={i}>
              <circle cx={crater.x} cy={crater.y} r={crater.r} fill="url(#crater-shade)" />
              <circle
                cx={crater.x}
                cy={crater.y}
                r={crater.r}
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.5"
                opacity={crater.depth}
              />
            </g>
          ))}

          {/* Light falls from the sun's side; the opposite limb rolls away. */}
          <radialGradient id="moon-shade" cx="34%" cy="30%" r="86%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="62%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#0b1020" stopOpacity="0.42" />
          </radialGradient>
          <circle cx="50" cy="50" r="50" fill="url(#moon-shade)" />
        </g>
      </g>

      {/* Earthshine: the unlit part is never truly black. */}
      <circle cx="50" cy="50" r="50" fill="#8fa2c8" opacity="0.07" />
    </svg>
  );
}
