import { PRAYER_META, PRAYER_ORDER, type DayTimes, type PrayerKey, type Settings } from '../lib/prayer';
import { formatTime } from '../lib/time';

interface BoardProps {
  day: DayTimes;
  /** The adhan times, always — so iqama view can show both side by side. */
  adhanDay: DayTimes;
  now: Date;
  timezone: string;
  settings: Settings;
  iqama: boolean;
  friday: boolean;
  nextKey: PrayerKey;
  nextIsToday: boolean;
  currentKey: PrayerKey | null;
}

function rowState(props: BoardProps, key: PrayerKey) {
  const time = props.day.times[key];
  return {
    time,
    isNext: props.nextIsToday && props.nextKey === key,
    isCurrent: props.currentKey === key,
    passed: time.getTime() <= props.now.getTime(),
    offset: props.settings.offsets[key],
    noCongregation: props.iqama && props.settings.iqamaOffsets[key] === null,
    label: props.friday && key === 'dhuhr' && props.iqama ? 'Jumuʿah' : PRAYER_META[key].en,
    arabic: props.friday && key === 'dhuhr' && props.iqama ? 'الجمعة' : PRAYER_META[key].ar,
  };
}

function rowNote(props: BoardProps, key: PrayerKey): string {
  const state = rowState(props, key);
  if (state.noCongregation) return 'No congregation';
  if (state.isCurrent) return 'Now';
  if (props.iqama && props.settings.iqamaOffsets[key] !== null) {
    return props.friday && key === 'dhuhr'
      ? 'Fixed by the authority'
      : `${props.settings.iqamaOffsets[key]} min after the adhan`;
  }
  return PRAYER_META[key].note;
}

/** The stacked list: one row per prayer, with room for the explanatory note. */
function ListBoard(props: BoardProps) {
  return (
    <section className="card rounded-3xl p-1.5 sm:p-2">
      {PRAYER_ORDER.map((key) => {
        const state = rowState(props, key);
        return (
          <div
            key={key}
            className={`flex min-h-[3.5rem] items-center gap-3 rounded-2xl px-3.5 py-2.5 transition sm:px-4 ${
              state.isNext ? 'bg-white/10' : state.isCurrent ? 'bg-white/5' : ''
            }`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${
                state.isNext
                  ? 'bg-[var(--accent)]'
                  : state.passed
                    ? 'bg-[var(--ink-faint)]'
                    : 'bg-transparent'
              }`}
            />
            <span className="min-w-0 flex-1">
              <span
                className={`flex items-baseline gap-2 text-[15px] font-medium sm:text-base ${
                  state.passed && !state.isCurrent ? 'text-[var(--ink-dim)]' : ''
                }`}
              >
                {state.label}
                <span className="arabic text-sm font-normal text-[var(--ink-faint)]">
                  {state.arabic}
                </span>
                {state.offset !== 0 && (
                  <span className="tabular rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-[var(--ink-dim)]">
                    {state.offset > 0 ? '+' : ''}
                    {state.offset}
                  </span>
                )}
              </span>
              <span className="block truncate text-[11px] text-[var(--ink-faint)] sm:text-xs">
                {props.iqama && !state.noCongregation ? (
                  <>
                    adhan{' '}
                    <span className="tabular text-[var(--ink-dim)]">
                      {formatTime(props.adhanDay.times[key], props.timezone, props.settings.timeFormat)}
                    </span>{' '}
                    · {rowNote(props, key)}
                  </>
                ) : (
                  rowNote(props, key)
                )}
              </span>
            </span>
            <span
              className={`tabular w-[4.5rem] shrink-0 text-right text-[17px] sm:w-[5rem] sm:text-lg ${
                state.isNext
                  ? 'font-semibold text-[var(--accent)]'
                  : state.noCongregation
                    ? 'text-[var(--ink-faint)]'
                    : state.passed
                      ? 'text-[var(--ink-dim)]'
                      : ''
              }`}
            >
              {formatTime(state.time, props.timezone, props.settings.timeFormat)}
            </span>
          </div>
        );
      })}
    </section>
  );
}

/** Six tiles, three across: the whole day readable at a glance. */
function GridBoard(props: BoardProps) {
  return (
    <section className="grid grid-cols-3 gap-2">
      {PRAYER_ORDER.map((key) => {
        const state = rowState(props, key);
        return (
          <div
            key={key}
            className={`card relative flex aspect-square flex-col items-center justify-center rounded-2xl p-2 text-center transition ${
              state.isNext ? 'ring-1 ring-[var(--accent-soft)]' : ''
            }`}
          >
            {state.isNext && (
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            )}
            <span
              className={`text-[13px] font-medium leading-tight sm:text-sm ${
                state.passed && !state.isCurrent && !state.isNext ? 'text-[var(--ink-dim)]' : ''
              }`}
            >
              {state.label}
            </span>
            <span className="arabic mt-0.5 text-[11px] text-[var(--ink-faint)]">
              {state.arabic}
            </span>
            <span
              className={`tabular mt-1.5 text-[19px] leading-none sm:text-xl ${
                state.isNext
                  ? 'font-semibold text-[var(--accent)]'
                  : state.noCongregation
                    ? 'text-[var(--ink-faint)]'
                    : state.passed
                      ? 'text-[var(--ink-dim)]'
                      : ''
              }`}
            >
              {formatTime(state.time, props.timezone, props.settings.timeFormat)}
            </span>
            {props.iqama && !state.noCongregation && (
              <span className="tabular mt-1 text-[10px] leading-tight text-[var(--ink-faint)]">
                adhan {formatTime(props.adhanDay.times[key], props.timezone, props.settings.timeFormat)}
              </span>
            )}
            {(state.noCongregation || state.isCurrent) && (
              <span className="mt-1 text-[10px] leading-tight text-[var(--ink-faint)]">
                {state.noCongregation ? 'no congregation' : 'now'}
              </span>
            )}
            {state.offset !== 0 && (
              <span className="tabular absolute bottom-2 text-[10px] text-[var(--ink-faint)]">
                {state.offset > 0 ? '+' : ''}
                {state.offset} min
              </span>
            )}
          </div>
        );
      })}
    </section>
  );
}

export function PrayerBoard(props: BoardProps) {
  return props.settings.prayerLayout === 'grid' ? <GridBoard {...props} /> : <ListBoard {...props} />;
}
