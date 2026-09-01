/**
 * Small diagrams for the settings panel.
 *
 * A sentence describing a layout is slower to read than the layout itself, so
 * each option shows the thing it does. These are deliberately tiny and abstract
 * — enough to recognise the shape of the choice, not a screenshot.
 */

const line = 'var(--card-line)';
const ink = 'var(--ink-dim)';
const accent = 'var(--accent)';

export function LayoutPreview({ variant }: { variant: 'list' | 'grid' }) {
  return (
    <svg viewBox="0 0 72 44" className="h-11 w-[72px]" aria-hidden="true">
      {variant === 'list'
        ? [0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x="2" y={2 + i * 10.5} width="68" height="8.5" rx="3" fill={line} />
              <rect x="6" y={5 + i * 10.5} width="22" height="3" rx="1.5" fill={i === 1 ? accent : ink} />
              <rect x="52" y={5 + i * 10.5} width="14" height="3" rx="1.5" fill={i === 1 ? accent : ink} />
            </g>
          ))
        : [0, 1, 2, 3, 4, 5].map((i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            return (
              <g key={i}>
                <rect x={2 + col * 23.5} y={4 + row * 19} width="21" height="17" rx="4" fill={line} />
                <rect x={6 + col * 23.5} y={8 + row * 19} width="13" height="3" rx="1.5" fill={i === 4 ? accent : ink} />
                <rect x={6 + col * 23.5} y={14 + row * 19} width="9" height="3.5" rx="1.5" fill={i === 4 ? accent : ink} />
              </g>
            );
          })}
    </svg>
  );
}

/** Adhan, the gap, then the congregation — the thing the offsets control. */
export function IqamaPreview({ minutes }: { minutes: number }) {
  const span = Math.min(1, minutes / 30);
  return (
    <svg viewBox="0 0 108 26" className="h-6 w-[108px]" aria-hidden="true">
      <line x1="8" y1="17" x2="100" y2="17" stroke={line} strokeWidth="2" strokeLinecap="round" />
      <line
        x1="8"
        y1="17"
        x2={8 + 92 * span}
        y2="17"
        stroke={accent}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.75"
      />
      <circle cx="8" cy="17" r="3.5" fill={ink} />
      <circle cx={8 + 92 * span} cy="17" r="3.5" fill={accent} />
      <text x="8" y="8" fontSize="7" fill={ink} textAnchor="start">
        adhan
      </text>
      <text x={Math.min(100, 8 + 92 * span)} y="8" fontSize="7" fill={accent} textAnchor="end">
        iqama
      </text>
    </svg>
  );
}

/** Where the correction moves a time, and which way. */
export function OffsetPreview({ minutes }: { minutes: number }) {
  const shift = Math.max(-1, Math.min(1, minutes / 30));
  return (
    <svg viewBox="0 0 64 18" className="h-[18px] w-16" aria-hidden="true">
      <line x1="4" y1="9" x2="60" y2="9" stroke={line} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="32" y1="4" x2="32" y2="14" stroke={line} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={32 + shift * 26} cy="9" r="3.5" fill={minutes === 0 ? ink : accent} />
    </svg>
  );
}

/** Twelve/twenty-four hour, shown as the face rather than described. */
export function ClockFormatPreview({ format }: { format: '24h' | '12h' }) {
  return (
    <svg viewBox="0 0 64 26" className="h-[26px] w-16" aria-hidden="true">
      <text x="32" y="19" fontSize={format === '24h' ? 17 : 14} fill={ink} textAnchor="middle" fontFamily="ui-sans-serif, system-ui" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {format === '24h' ? '18:41' : '6:41 PM'}
      </text>
    </svg>
  );
}
