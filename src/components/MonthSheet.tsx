import { useMemo, useState } from 'react';
import { Sheet } from './Sheet';
import { PRAYER_ORDER, computeDay } from '../lib/prayer';
import { civilDateIn, formatTime } from '../lib/time';
import { useStore } from '../lib/store';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function MonthContent() {
  const { place, settings } = useStore();
  const today = place ? civilDateIn(place.timezone) : civilDateIn('UTC');
  const [cursor, setCursor] = useState({ year: today.year, month: today.month });

  const rows = useMemo(() => {
    if (!place) return [];
    const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const anchor = new Date(cursor.year, cursor.month - 1, i + 1, 12);
      return {
        day: i + 1,
        weekday: anchor.toLocaleDateString(undefined, { weekday: 'short' }),
        isToday:
          cursor.year === today.year && cursor.month === today.month && i + 1 === today.day,
        ...computeDay(place.latitude, place.longitude, anchor, settings),
      };
    });
  }, [place, settings, cursor, today.year, today.month, today.day]);

  const step = (delta: number) => {
    const next = new Date(cursor.year, cursor.month - 1 + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() + 1 });
  };

  if (!place) return null;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => step(-1)}
          className="rounded-full px-3 py-1.5 text-sm text-[var(--ink-dim)] transition hover:bg-white/10"
        >
          ← Prev
        </button>
        <span className="text-sm font-medium">
          {MONTH_NAMES[cursor.month - 1]} {cursor.year}
        </span>
        <button
          onClick={() => step(1)}
          className="rounded-full px-3 py-1.5 text-sm text-[var(--ink-dim)] transition hover:bg-white/10"
        >
          Next →
        </button>
      </div>

      <div className="-mx-2 overflow-x-auto">
        <table className="tabular w-full min-w-[420px] text-[13px]">
          <thead className="sticky top-0 bg-[var(--sky-bottom)]/85 backdrop-blur">
            <tr className="text-right text-[11px] uppercase tracking-wider text-[var(--ink-faint)]">
              <th className="px-2 py-2 text-left font-medium">Day</th>
              {PRAYER_ORDER.map((key) => (
                <th key={key} className="px-2 py-2 font-medium capitalize">
                  {key === 'sunrise' ? 'Rise' : key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.day}
                className={`border-t border-[var(--card-line)] text-right ${
                  row.isToday ? 'bg-white/8 font-medium' : ''
                }`}
              >
                <td className="px-2 py-2 text-left text-[var(--ink-dim)]">
                  {row.day} <span className="text-[var(--ink-faint)]">{row.weekday}</span>
                </td>
                {PRAYER_ORDER.map((key) => (
                  <td key={key} className="px-2 py-2">
                    {formatTime(row.times[key], place.timezone, settings.timeFormat)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function MonthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} title="Monthly timetable" onClose={onClose}>
      <MonthContent />
    </Sheet>
  );
}
