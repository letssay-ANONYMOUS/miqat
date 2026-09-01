export type DialStyle = 'arc' | 'ticks' | 'sweep' | 'orbit' | 'chronograph';

export const DIAL_STYLES: { value: DialStyle; label: string; hint: string }[] = [
  { value: 'arc', label: 'Arc', hint: 'A single thin line closing' },
  { value: 'ticks', label: 'Ticks', hint: 'Sixty marks, lighting one by one' },
  { value: 'sweep', label: 'Sweep', hint: 'A hand, with seconds' },
  { value: 'orbit', label: 'Orbit', hint: 'A point circling, with a trail' },
  { value: 'chronograph', label: 'Chronograph', hint: 'Twelve segments filling' },
];

const R = 94;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Point on the dial at a given fraction, measured clockwise from the top. */
function at(fraction: number, radius: number) {
  const angle = (fraction * 360 - 90) * (Math.PI / 180);
  return { x: 100 + radius * Math.cos(angle), y: 100 + radius * Math.sin(angle) };
}

interface DialProps {
  style: DialStyle;
  /** 0 when the last prayer passed, 1 at the next. */
  progress: number;
  /** Seconds hand position, 0–1 within the current minute. */
  seconds: number;
}

/**
 * The ring around the countdown. Every face is drawn on the same 200×200 grid
 * at the same radius, so switching between them never moves the numerals, and
 * every moving part is a transform or a dash offset — cheap to animate and
 * smooth without a single frame of JavaScript.
 */
export function Dial({ style, progress, seconds }: DialProps) {
  const eased = Math.min(1, Math.max(0, progress));

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 200 200"
      aria-hidden="true"
    >
      {style === 'arc' && <Arc progress={eased} />}
      {style === 'ticks' && <Ticks progress={eased} seconds={seconds} />}
      {style === 'sweep' && <Sweep progress={eased} seconds={seconds} />}
      {style === 'orbit' && <Orbit progress={eased} seconds={seconds} />}
      {style === 'chronograph' && <Chronograph progress={eased} seconds={seconds} />}
    </svg>
  );
}

function Track({ width = 1.3, opacity = 1 }: { width?: number; opacity?: number }) {
  return (
    <circle
      cx="100"
      cy="100"
      r={R}
      fill="none"
      stroke="var(--card-line)"
      strokeWidth={width}
      opacity={opacity}
    />
  );
}

function Arc({ progress }: { progress: number }) {
  return (
    <>
      <Track />
      <circle
        cx="100"
        cy="100"
        r={R}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        transform="rotate(-90 100 100)"
        opacity="0.75"
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </>
  );
}

/** Sixty marks; the ones already elapsed are lit, the leading one brightest. */
function Ticks({ progress, seconds }: { progress: number; seconds: number }) {
  const lit = progress * 60;
  return (
    <>
      {Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0;
        const elapsed = i < lit;
        const leading = Math.floor(lit) === i;
        return (
          <line
            key={i}
            x1="100"
            y1={100 - R - (major ? 4 : 2)}
            x2="100"
            y2={100 - R + (major ? 4 : 2)}
            stroke={elapsed ? 'var(--accent)' : 'var(--card-line)'}
            strokeWidth={major ? 1.7 : 1}
            strokeLinecap="round"
            opacity={leading ? 1 : elapsed ? 0.62 : 0.85}
            transform={`rotate(${i * 6} 100 100)`}
            style={{ transition: 'stroke .6s linear, opacity .6s linear' }}
          />
        );
      })}
      <circle
        {...at(seconds, R)}
        r="1.8"
        fill="var(--accent)"
        style={{ transition: 'cx 1s linear, cy 1s linear' }}
      />
    </>
  );
}

/** An analogue hand for the interval, plus a true seconds hand. */
function Sweep({ progress, seconds }: { progress: number; seconds: number }) {
  return (
    <>
      <Track />
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={i}
          x1="100"
          y1={100 - R + 3}
          x2="100"
          y2={100 - R + 9}
          stroke="var(--ink-faint)"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.55"
          transform={`rotate(${i * 30} 100 100)`}
        />
      ))}
      <g
        transform={`rotate(${progress * 360} 100 100)`}
        style={{ transition: 'transform 1s linear' }}
      >
        <line
          x1="100"
          y1="100"
          x2="100"
          y2={100 - R + 16}
          stroke="var(--accent)"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>
      <g
        transform={`rotate(${seconds * 360} 100 100)`}
        style={{ transition: 'transform 1s linear' }}
      >
        <line
          x1="100"
          y1="108"
          x2="100"
          y2={100 - R + 8}
          stroke="var(--ink-dim)"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>
      <circle cx="100" cy="100" r="2.6" fill="var(--accent)" />
    </>
  );
}

/** A single point going round, dragging a fading tail behind it. */
function Orbit({ progress, seconds }: { progress: number; seconds: number }) {
  const head = at(progress, R);
  const tail = Math.min(0.16, progress);
  return (
    <>
      <Track opacity={0.7} />
      <circle
        cx="100"
        cy="100"
        r={R}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray={`${CIRCUMFERENCE * tail} ${CIRCUMFERENCE}`}
        strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        transform="rotate(-90 100 100)"
        opacity="0.5"
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
      <g style={{ transition: 'transform 1s linear' }} transform={`rotate(${progress * 360} 100 100)`}>
        <circle cx="100" cy={100 - R} r="5" fill="var(--accent)" opacity="0.22" />
        <circle cx="100" cy={100 - R} r="2.6" fill="var(--accent)" />
      </g>
      <circle
        cx={head.x}
        cy={head.y}
        r="0"
        fill="none"
      />
      <circle
        {...at(seconds, R - 11)}
        r="1.3"
        fill="var(--ink-dim)"
        opacity="0.65"
        style={{ transition: 'cx 1s linear, cy 1s linear' }}
      />
    </>
  );
}

/** Twelve fat segments filling in turn, like a chronograph bezel. */
function Chronograph({ progress, seconds }: { progress: number; seconds: number }) {
  const segments = 12;
  const gap = 0.16;
  const arc = CIRCUMFERENCE / segments;
  return (
    <>
      {Array.from({ length: segments }, (_, i) => {
        const start = i / segments;
        const fill = Math.min(1, Math.max(0, (progress - start) * segments));
        return (
          <g key={i} transform={`rotate(${(i * 360) / segments - 90} 100 100)`}>
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="var(--card-line)"
              strokeWidth="5"
              strokeLinecap="butt"
              strokeDasharray={`${arc * (1 - gap)} ${CIRCUMFERENCE}`}
            />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="5"
              strokeLinecap="butt"
              strokeDasharray={`${arc * (1 - gap) * fill} ${CIRCUMFERENCE}`}
              opacity="0.8"
              style={{ transition: 'stroke-dasharray 1s linear' }}
            />
          </g>
        );
      })}
      <circle
        {...at(seconds, R - 12)}
        r="1.6"
        fill="var(--ink-dim)"
        opacity="0.7"
        style={{ transition: 'cx 1s linear, cy 1s linear' }}
      />
    </>
  );
}
