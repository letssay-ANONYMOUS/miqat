import { countdown, formatCountdown, formatTime } from '../lib/time';
import type { Settings } from '../lib/prayer';

export type ClockStyle = 'light' | 'serif' | 'mono' | 'words' | 'target';

export const CLOCK_STYLES: { value: ClockStyle; label: string; sample: string }[] = [
  { value: 'light', label: 'Light', sample: '1:28:33' },
  { value: 'serif', label: 'Serif', sample: '1:28:33' },
  { value: 'mono', label: 'Mono', sample: '1:28:33' },
  { value: 'words', label: 'Words', sample: '1 hr 28 min' },
  { value: 'target', label: 'The time', sample: '04:39' },
];

/**
 * The countdown, in whichever style is set. Every one keeps tabular figures so
 * the digits do not jitter as they tick, and each is sized to sit inside the
 * ring without crowding it.
 */
export function Countdown({
  msRemaining,
  at,
  timezone,
  settings,
}: {
  msRemaining: number;
  at: Date;
  timezone: string;
  settings: Settings;
}) {
  const style = settings.clockStyle;
  const { hours, minutes } = countdown(msRemaining);

  if (style === 'words') {
    return (
      <p className="clock-words px-6 text-center leading-tight">
        {hours > 0 && (
          <>
            <span className="tabular">{hours}</span>
            <span className="unit"> hr </span>
          </>
        )}
        <span className="tabular">{minutes}</span>
        <span className="unit"> min</span>
      </p>
    );
  }

  if (style === 'target') {
    return (
      <div className="text-center">
        <p className="tabular clock-target leading-none">
          {formatTime(at, timezone, settings.timeFormat)}
        </p>
        <p className="tabular mt-2 text-sm text-[var(--ink-dim)]">
          in {formatCountdown(msRemaining)}
        </p>
      </div>
    );
  }

  return <p className={`tabular clock-${style} leading-none`}>{formatCountdown(msRemaining)}</p>;
}
