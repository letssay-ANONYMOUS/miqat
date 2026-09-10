import { useEffect, useMemo, useRef, useState } from 'react';
import { Sky } from './components/Sky';
import { QiblaCompass } from './components/QiblaCompass';
import { LocationSheet } from './components/LocationSheet';
import { SettingsContent } from './components/SettingsSheet';
import { VerifySheet } from './components/VerifySheet';
import { TabBar, type Page } from './components/TabBar';
import { VerificationNote } from './components/VerificationNote';
import { AuditStatus } from './components/AuditStatus';
import { MonthContent } from './components/MonthSheet';
import { QuranPage } from './components/QuranPage';
import { Onboarding } from './components/Onboarding';
import { Segmented } from './components/Segmented';
import { Countdown } from './components/Countdown';
import { PrayerBoard } from './components/PrayerBoard';
import { Dial } from './components/Dial';
import { DailyWidget } from './components/DailyWidget';
import { METHOD_BY_KEY } from './lib/methods';
import {
  PRAYER_META,
  PRAYER_ORDER,
  applyIqama,
  computeDay,
  isFriday,
  qiblaDegrees,
  resolveNext,
} from './lib/prayer';
import {
  civilDateIn,
  dayAnchor,
  formatHijri,
  formatLongDate,
  formatTime,
  humanRemaining,
} from './lib/time';
import { useStore } from './lib/store';
import { useRubberBand } from './lib/feel';
import { scheduleAlarms, type Alarm } from './lib/notify';
import { track } from './lib/analytics';
import { isNowPlaying, startNowPlaying, stopNowPlaying, update as updateNowPlaying } from './lib/nowPlaying';
import { useI18n } from './lib/i18n';
import { localizedUaeName } from './lib/uaePlaces';
import { DevotionsPage } from './components/DevotionsPage';
import { writePreferenceCookie } from './lib/preferenceCookie';

type SheetName = 'location' | 'verify';

/** Big enough to clear the countdown at every width, small enough to sit
    between the prayer name and the board without touching either. */
const RING_SIZE = 'clamp(13.5rem, 62vw, 17rem)';

export default function App() {
  const { place, settings, viewMode, setViewMode, sharePreciseLocation } = useStore();
  const { language, locale, isArabic, text, methodLabel, methodSummary } = useI18n();
  const [now, setNow] = useState(() => new Date());
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useRubberBand(scroller);
  const [page, setPage] = useState<Page>('times');
  const [quranReading, setQuranReading] = useState(false);
  const [devotionsOpen, setDevotionsOpen] = useState(false);
  const [quranRequest, setQuranRequest] = useState<{ surah: number; token: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    if (!place) document.title = text('Miqāt — Prayer Times', 'ميقات — مواقيت الصلاة');
  }, [language, isArabic, place, text]);

  useEffect(() => {
    writePreferenceCookie(place, settings, viewMode);
  }, [place, settings, viewMode]);

  const timezone = place?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const civil = civilDateIn(timezone, now);
  const dayKey = `${civil.year}-${civil.month}-${civil.day}`;
  const iqama = viewMode === 'iqama';

  // Recomputed only when the day, the location or a setting changes — not every tick.
  const days = useMemo(() => {
    if (!place) return null;
    const build = (offset: number) => {
      const day = computeDay(
        place.latitude,
        place.longitude,
        dayAnchor(timezone, offset, now),
        settings,
      );
      return { adhan: day, shown: iqama ? applyIqama(day, settings, timezone) : day };
    };
    const [y, t, m] = [build(-1), build(0), build(1)];
    return {
      yesterday: y.shown,
      today: t.shown,
      tomorrow: m.shown,
      todayAdhan: t.adhan,
      yesterdayAdhan: y.adhan,
      tomorrowAdhan: m.adhan,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, settings, timezone, dayKey, iqama]);

  /*
   * Sunrise stays in the countdown even in Iqama view. Skipping it made the
   * board jump from Fajr straight to Dhuhr's iqama while sunrise was still
   * hours away and still listed — it read as the sunrise row showing Dhuhr's
   * time. It has no congregation, which the label says, but it is a real
   * boundary: the Fajr window closes there.
   */
  const next = days ? resolveNext(days.today, days.tomorrow, now, days.yesterday) : null;
  const lockIqama = settings.lockScreenMode === 'iqama';
  const lockNext =
    days && settings.lockScreenEnabled
      ? resolveNext(
          lockIqama ? applyIqama(days.todayAdhan, settings, timezone) : days.todayAdhan,
          lockIqama ? applyIqama(days.tomorrowAdhan, settings, timezone) : days.tomorrowAdhan,
          now,
          lockIqama ? applyIqama(days.yesterdayAdhan, settings, timezone) : days.yesterdayAdhan,
          lockIqama ? ['sunrise'] : [],
        )
      : null;

  useEffect(() => {
    if (place && next) {
      document.title = `${formatTime(next.at, timezone, settings.timeFormat, locale)} ${
        isArabic ? PRAYER_META[next.key].ar : PRAYER_META[next.key].en
      } · Miqāt`;
    }
  }, [place, next?.key, next?.at, timezone, settings.timeFormat, locale, isArabic]);

  // Usage reporting, throttled inside track(). Never blocks or affects the times.
  useEffect(() => {
    if (!place) return;
    void track({ place, method: settings.method, sharePreciseLocation });
  }, [place, settings.method, sharePreciseLocation]);

  /*
   * Keep the lock screen and Dynamic Island pointed at the next prayer while
   * the setting is on. Starting playback needs a gesture, which the settings
   * toggle provides; from then on this only refreshes the text.
   */
  useEffect(() => {
    if (!place || !lockNext) {
      if (!settings.lockScreenEnabled && isNowPlaying()) stopNowPlaying();
      return;
    }
    if (!settings.lockScreenEnabled) {
      if (isNowPlaying()) stopNowPlaying();
      return;
    }
    const name = isArabic ? PRAYER_META[lockNext.key].ar : PRAYER_META[lockNext.key].en;
    const kind = lockIqama
      ? text('Iqama', 'الإقامة')
      : text('Adhan', 'الأذان');
    const info = {
      prayer: `${kind} · ${name}`,
      at: formatTime(lockNext.at, timezone, settings.timeFormat, locale),
      remaining: text(
        `in ${humanRemaining(lockNext.msRemaining)}`,
        `متبقي ${humanRemaining(lockNext.msRemaining, 'ar')}`,
      ),
      place: place.name,
    };
    if (isNowPlaying()) updateNowPlaying(info);
    else void startNowPlaying(info);
  }, [
    place,
    settings.lockScreenEnabled,
    settings.lockScreenMode,
    lockNext?.key,
    Math.floor((lockNext?.msRemaining ?? 0) / 60_000),
    timezone,
    settings.timeFormat,
    locale,
    isArabic,
    language,
    lockIqama,
  ]);

  // Alarms for the rest of today and tomorrow, re-armed whenever the board changes.
  useEffect(() => {
    if (!days || !place || (!settings.notifyEnabled && !settings.soundEnabled)) return;
    const alarms: Alarm[] = [];
    for (const day of [days.today, days.tomorrow]) {
      for (const key of PRAYER_ORDER) {
        if (key === 'sunrise') continue;
        alarms.push({
          key,
          at: day.times[key],
          lead: settings.notifyLead,
          label: iqama ? text('congregation', 'الإقامة') : text('adhan', 'الأذان'),
        });
      }
    }
    return scheduleAlarms(alarms, (date) => formatTime(date, timezone, settings.timeFormat, locale), {
      sound: settings.soundEnabled,
      volume: settings.soundVolume,
    });
  }, [
    days,
    place,
    iqama,
    settings.notifyEnabled,
    settings.notifyLead,
    settings.soundEnabled,
    settings.soundVolume,
    settings.timeFormat,
    timezone,
    locale,
    language,
  ]);

  if (!place || !days || !next) return <Onboarding />;

  const method = METHOD_BY_KEY.get(settings.method)!;
  const qibla = qiblaDegrees(place.latitude, place.longitude);
  const friday = isFriday(days.today, timezone);

  return (
    <div lang={language} dir={isArabic ? 'rtl' : 'ltr'} className={quranReading ? 'mushaf-root' : 'sky relative min-h-dvh overflow-hidden'}>
      {!quranReading && (
        <Sky latitude={place.latitude} longitude={place.longitude} scene={page === 'times'} />
      )}

      <div
        ref={scroller}
        className={
          quranReading
            ? 'relative z-10 w-full'
            : 'relative z-10 mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 page-bottom-space pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5'
        }
      >
        {!quranReading && (
        <header className="flex items-start justify-between gap-2">
          <button
            onClick={() => setSheet('location')}
            className="group -ms-2 min-w-0 flex-1 rounded-2xl px-2 py-2 text-start transition active:bg-white/10"
          >
            <span className="flex items-center gap-1.5 text-xl font-semibold tracking-tight">
              <span className="truncate">{localizedUaeName(place.name, language)}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                className="shrink-0 text-[var(--ink-faint)]"
                aria-hidden="true"
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-[var(--ink-dim)]">
              {formatLongDate(now, timezone, locale)}
            </span>
            <span className="arabic block truncate text-[13px] text-[var(--ink-dim)]">
              {formatHijri(now, timezone, settings.hijriOffset, language)}
            </span>
          </button>

          <nav className="flex shrink-0 items-center">
            <IconButton label={text('Dhikr and daily rituals', 'الذكر والأذكار اليومية')} onClick={() => setDevotionsOpen(true)}>
              <circle cx="6" cy="6" r="2.1" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="14" cy="6" r="2.1" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="10" cy="13.7" r="2.1" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7.8 7.2l1.3 4.5M12.2 7.2l-1.3 4.5M8.1 14.8l-2.7 2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
            </IconButton>
            <IconButton label={text('Accuracy', 'الدقة')} onClick={() => setSheet('verify')}>
              <path d="M10 2.5l6 2.5v5c0 3.4-2.4 6.4-6 7.5-3.6-1.1-6-4.1-6-7.5V5l6-2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M7.5 10l1.8 1.8L13 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </IconButton>
          </nav>
        </header>
        )}

        {page === 'times' && (
          <>
        <div className="mt-3 flex justify-center">
          <div className="w-[15rem]">
            <Segmented
              label={text('Which times to show', 'نوع المواقيت المعروضة')}
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'adhan', label: text('Adhan', 'الأذان') },
                { value: 'iqama', label: text('Iqama', 'الإقامة') },
              ]}
            />
          </div>
        </div>

        <section className="flex flex-1 flex-col items-center justify-center py-6 text-center sm:py-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-[var(--ink-dim)]">
            {next.tomorrow
              ? text('Tomorrow', 'غدًا')
              : iqama && settings.iqamaOffsets[next.key] === null
                ? text('Next · no congregation', 'التالي · بلا إقامة')
                : iqama
                  ? text('Next congregation', 'الإقامة التالية')
                  : text('Next', 'الصلاة التالية')}
          </p>
          <h1 className="mt-2 flex flex-wrap items-baseline justify-center gap-x-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {isArabic
              ? friday && next.key === 'dhuhr' ? 'الجمعة' : PRAYER_META[next.key].ar
              : friday && next.key === 'dhuhr' ? 'Jumuʿah' : PRAYER_META[next.key].en}
            <span className={`${isArabic ? '' : 'arabic'} text-2xl font-normal text-[var(--accent)] sm:text-3xl`}>
              {isArabic
                ? friday && next.key === 'dhuhr' ? 'Jumuʿah' : PRAYER_META[next.key].en
                : friday && next.key === 'dhuhr' ? 'الجمعة' : PRAYER_META[next.key].ar}
            </span>
          </h1>

          <div className="mt-4 flex flex-col items-center">
            <div
              className="relative flex items-center justify-center"
              style={{ width: RING_SIZE, height: RING_SIZE }}
            >
              <Dial
                style={settings.dialStyle}
                progress={next.progress}
                seconds={now.getSeconds() / 60}
              />
              <div className="relative">
                <Countdown
                  msRemaining={next.msRemaining}
                  at={next.at}
                  timezone={timezone}
                  settings={settings}
                />
              </div>
            </div>
            {settings.clockStyle !== 'target' && (
              <p className="mt-3 text-[13px] text-[var(--ink-dim)] sm:text-sm">
                {text('at', 'عند')}{' '}
                <span className="tabular font-medium text-[var(--ink)]">
                  {formatTime(next.at, timezone, settings.timeFormat, locale)}
                </span>{' '}
                · {text(`${humanRemaining(next.msRemaining)} away`, `متبقي ${humanRemaining(next.msRemaining, 'ar')}`)}
              </p>
            )}
          </div>
        </section>

        <PrayerBoard
          day={days.today}
          adhanDay={days.todayAdhan}
          now={now}
          timezone={timezone}
          settings={settings}
          iqama={iqama}
          friday={friday}
          nextKey={next.key}
          nextIsToday={!next.tomorrow}
          currentKey={next.current}
        />

        <DailyWidget />

        <section className="card mt-3 grid grid-cols-2 gap-x-8 gap-y-2 rounded-3xl px-5 py-4 text-sm">
          <Stat label={text('Midnight', 'منتصف الليل')} value={formatTime(days.today.midnight, timezone, settings.timeFormat, locale)} />
          <Stat label={text('Last third', 'الثلث الأخير')} value={formatTime(days.today.lastThird, timezone, settings.timeFormat, locale)} />
        </section>

        <footer className="mt-4 space-y-1.5 px-1 text-[11px] leading-relaxed text-[var(--ink-faint)] sm:text-xs">
          <p>
            <button
              onClick={() => setPage('settings')}
              className="text-[var(--ink-dim)] underline underline-offset-4"
            >
              {methodLabel(method.key, method.label)}
            </button>{' '}
            · {methodSummary(method.summary)} · {text('Asr', 'العصر')} {settings.madhab === 'hanafi' ? text('Hanafi', 'حنفي') : text('standard', 'المعيار المعتاد')}
            {iqama && text(' · showing iqama', ' · عرض الإقامة')}
          </p>
          <p className="tabular">
            {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)} · {timezone}
          </p>
          {days.today.source === 'official' ? (
            <p className="text-[var(--ink-dim)]">
              {text(
                `These are Awqaf's own published times for ${days.today.officialCity}, not a calculation.`,
                `هذه مواقيت الأوقاف المنشورة لمدينة ${localizedUaeName(days.today.officialCity ?? '', language)} وليست ناتجة عن حساب فلكي.`,
              )}
            </p>
          ) : method.verifiedAgainst ? (
            <p className="text-[var(--ink-dim)]">
              {text(
                `Calculated — Awqaf has not published this date yet. Checked against ${method.verifiedAgainst.authority}: every one of ${method.verifiedAgainst.comparisons.toLocaleString()} published times matched within a minute.`,
                `محسوبة فلكيًا — لم تنشر الأوقاف هذا التاريخ بعد. تمت مطابقتها مع ${method.verifiedAgainst.authority}، وتطابقت جميع المواقيت المنشورة البالغ عددها ${method.verifiedAgainst.comparisons.toLocaleString(locale)} ضمن دقيقة واحدة.`,
              )}
            </p>
          ) : (
            <p>
              {text(
                `Computed from this convention's published parameters, but not yet checked against a timetable published by the authority in ${method.region}.`,
                `محسوبة وفق المعايير المنشورة لهذه الطريقة، لكنها لم تُقارن بعد بجدول صادر عن الجهة الرسمية في ${method.region}.`,
              )}{' '}
              <button
                onClick={() => setSheet('verify')}
                className="text-[var(--ink-dim)] underline underline-offset-4"
              >
                {text('What this means', 'ماذا يعني ذلك؟')}
              </button>
            </p>
          )}
          <p>{text('Computed on your device. No account, no ads, nothing tracked.', 'تُحسب المواقيت على جهازك. بلا حساب، وبلا إعلانات، وبلا تتبع.')}</p>
        </footer>
          </>
        )}

        {page === 'qibla' && (
          <section className="flex flex-1 flex-col items-center gap-5 py-6">
            <QiblaCompass bearing={qibla} />
            <div className="card w-full rounded-3xl px-5 py-4 text-xs leading-relaxed text-[var(--ink-dim)]">
              <p className="mb-2 text-[13px] font-medium text-[var(--ink)]">{text('Getting it right', 'للحصول على اتجاه دقيق')}</p>
              <p>
                {text(
                  'Lay the phone flat, like a compass — held upright the sensor cannot tell which way you are facing. Keep it away from anything metal, and if the needle wanders, move the phone in a figure of eight to recalibrate it.',
                  'ضع الهاتف أفقيًا مثل البوصلة، لأن المستشعر لا يستطيع تحديد اتجاهك عندما يكون الهاتف عموديًا. أبعده عن المعادن، وإذا تحركت الإبرة بشكل غير ثابت فحرّك الهاتف على شكل رقم 8 لإعادة المعايرة.',
                )}
              </p>
              <p className="mt-2">
                {text('The daylight reference is calculated from your location and the sun. Check the direction using shadows; never look directly at the sun.', 'مرجع النهار محسوب من موقعك والشمس. تحقّق باستخدام الظلال ولا تنظر إلى الشمس مباشرة.')}
              </p>
            </div>
          </section>
        )}

        {page === 'quran' && (
          <section className={quranReading ? '' : 'flex-1 py-2'}>
            <QuranPage onReading={setQuranReading} openRequest={quranRequest} />
          </section>
        )}

        {page === 'month' && (
          <section className="flex-1 py-4">
            <MonthContent />
          </section>
        )}

        {page === 'settings' && (
          <section className="flex-1 py-4">
            <SettingsContent />
            <div className="mt-8 space-y-3">
              <VerificationNote />
              <AuditStatus />
            </div>
          </section>
        )}
      </div>

      <LocationSheet open={sheet === 'location'} onClose={() => setSheet(null)} />
      <VerifySheet open={sheet === 'verify'} onClose={() => setSheet(null)} />
      <TabBar page={page} onChange={setPage} />
      {devotionsOpen && (
        <DevotionsPage
          onClose={() => setDevotionsOpen(false)}
          onOpenMulk={() => {
            setDevotionsOpen(false);
            setQuranRequest({ surah: 67, token: Date.now() });
            setPage('quran');
            window.scrollTo(0, 0);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-[var(--ink-faint)]">{label}</p>
      <p className="tabular text-base">{value}</p>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--ink-dim)] transition active:bg-white/15"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}
