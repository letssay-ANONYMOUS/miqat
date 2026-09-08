import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Segmented } from './Segmented';
import { haptic } from '../lib/feel';
import { useI18n } from '../lib/i18n';
import { useStore, type DhikrCounts, type DhikrKind } from '../lib/store';

type Section = 'counter' | 'rituals';
type RitualPeriod = 'morning' | 'evening' | 'mulk';

const PHRASES: Record<DhikrKind, { en: string; ar: string; shortEn: string; shortAr: string }> = {
  istighfar: { en: 'Astaghfirullāh', ar: 'أستغفر الله', shortEn: 'Istighfar', shortAr: 'استغفار' },
  tasbih: { en: 'Subḥān Allāh', ar: 'سبحان الله', shortEn: 'Tasbih', shortAr: 'تسبيح' },
  tahmid: { en: 'Alḥamdulillāh', ar: 'الحمد لله', shortEn: 'Tahmid', shortAr: 'تحميد' },
  takbir: { en: 'Allāhu akbar', ar: 'الله أكبر', shortEn: 'Takbir', shortAr: 'تكبير' },
};

interface RitualItem {
  id: string;
  titleEn: string;
  titleAr: string;
  detailEn: string;
  detailAr: string;
  countEn: string;
  countAr: string;
  source: string;
}

const MORNING: RitualItem[] = [
  {
    id: 'morning-three-quls',
    titleEn: 'Al-Ikhlāṣ, Al-Falaq and An-Nās',
    titleAr: 'الإخلاص والفلق والناس',
    detailEn: 'Recite the three protecting surahs.',
    detailAr: 'اقرأ سور الحفظ الثلاث.',
    countEn: '3 times each',
    countAr: '3 مرات لكل سورة',
    source: 'Abu Dawud 5082 · Tirmidhi 3575',
  },
  {
    id: 'morning-ayat-kursi',
    titleEn: 'Āyat al-Kursī',
    titleAr: 'آية الكرسي',
    detailEn: 'Allah — there is no deity except Him, the Ever-Living, the Sustainer.',
    detailAr: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ.',
    countEn: 'Once',
    countAr: 'مرة واحدة',
    source: 'Qur’an 2:255',
  },
  {
    id: 'morning-sayyid',
    titleEn: 'The chief supplication for forgiveness',
    titleAr: 'سيد الاستغفار',
    detailEn: 'Allāhumma anta rabbī, lā ilāha illā anta…',
    detailAr: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ…',
    countEn: 'Once with certainty',
    countAr: 'مرة واحدة بيقين',
    source: 'Sahih al-Bukhari 6306',
  },
  {
    id: 'morning-bika',
    titleEn: 'Morning has come by You',
    titleAr: 'اللهم بك أصبحنا',
    detailEn: 'Allāhumma bika aṣbaḥnā, wa bika amsaynā, wa bika naḥyā, wa bika namūt, wa ilaykan-nushūr.',
    detailAr: 'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ.',
    countEn: 'Once',
    countAr: 'مرة واحدة',
    source: 'Tirmidhi 3391',
  },
  {
    id: 'morning-raditu',
    titleEn: 'Content with Allah, Islam and Muhammad',
    titleAr: 'رضيت بالله ربًا',
    detailEn: 'Raḍītu billāhi rabban, wa bil-Islāmi dīnan, wa bi-Muḥammadin nabiyyā.',
    detailAr: 'رَضِيتُ بِاللَّهِ رَبًّا وَبِالْإِسْلَامِ دِينًا وَبِمُحَمَّدٍ نَبِيًّا.',
    countEn: '3 times',
    countAr: '3 مرات',
    source: 'Abu Dawud 5072 · Tirmidhi 3389',
  },
  {
    id: 'morning-bismillah',
    titleEn: 'In Allah’s name, nothing can harm',
    titleAr: 'بسم الله الذي لا يضر',
    detailEn: 'Bismillāhilladhī lā yaḍurru maʿasmihi shay’un fil-arḍi wa lā fis-samā’, wa Huwas-Samīʿul-ʿAlīm.',
    detailAr: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ.',
    countEn: '3 times',
    countAr: '3 مرات',
    source: 'Abu Dawud 5088 · Tirmidhi 3388',
  },
  {
    id: 'morning-tasbih',
    titleEn: 'Subḥān Allāhi wa biḥamdih',
    titleAr: 'سبحان الله وبحمده',
    detailEn: 'Glory and praise belong to Allah.',
    detailAr: 'تنزيه لله وثناء عليه.',
    countEn: '100 times',
    countAr: '100 مرة',
    source: 'Sahih Muslim 2692',
  },
];

const EVENING: RitualItem[] = [
  { ...MORNING[0], id: 'evening-three-quls' },
  { ...MORNING[1], id: 'evening-ayat-kursi' },
  { ...MORNING[2], id: 'evening-sayyid' },
  {
    id: 'evening-bika',
    titleEn: 'Evening has come by You',
    titleAr: 'اللهم بك أمسينا',
    detailEn: 'Allāhumma bika amsaynā, wa bika aṣbaḥnā, wa bika naḥyā, wa bika namūt, wa ilaykal-maṣīr.',
    detailAr: 'اللَّهُمَّ بِكَ أَمْسَيْنَا وَبِكَ أَصْبَحْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ الْمَصِيرُ.',
    countEn: 'Once',
    countAr: 'مرة واحدة',
    source: 'Tirmidhi 3391',
  },
  { ...MORNING[4], id: 'evening-raditu' },
  { ...MORNING[5], id: 'evening-bismillah' },
  { ...MORNING[6], id: 'evening-tasbih' },
];

function dayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftedDay(offset: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return dayKey(date);
}

function countFor(counts: DhikrCounts | undefined, kind: DhikrKind): number {
  return counts?.[kind] ?? 0;
}

export function DevotionsPage({
  onClose,
  onOpenMulk,
}: {
  onClose: () => void;
  onOpenMulk: () => void;
}) {
  const { isArabic, locale, text } = useI18n();
  const [section, setSection] = useState<Section>('counter');
  const [period, setPeriod] = useState<RitualPeriod>(() => {
    const hour = new Date().getHours();
    return hour >= 16 || hour < 4 ? 'evening' : 'morning';
  });

  return (
    <div className="devotions-page fixed inset-0 z-40 overflow-y-auto overscroll-contain">
      <div className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
        <header className="flex items-center justify-between gap-3 py-2">
          <button type="button" onClick={onClose} className="devotions-back" aria-label={text('Back', 'رجوع')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d={isArabic ? 'M7 4l6 6-6 6' : 'M13 4l-6 6 6 6'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-lg font-semibold tracking-tight">{text('Daily devotion', 'العبادة اليومية')}</p>
            <p className="text-[11px] text-[var(--ink-faint)]">{text('Private and stored on this device', 'خاص ومحفوظ على هذا الجهاز')}</p>
          </div>
          <span className="h-10 w-10" aria-hidden="true" />
        </header>

        <div className="mt-3">
          <Segmented
            label={text('Devotion section', 'قسم العبادة')}
            value={section}
            onChange={setSection}
            options={[
              { value: 'counter', label: text('Counter', 'العداد') },
              { value: 'rituals', label: text('Daily rituals', 'الأذكار اليومية') },
            ]}
          />
        </div>

        {section === 'counter' ? <DhikrCounter /> : (
          <Rituals period={period} onPeriod={setPeriod} onOpenMulk={onOpenMulk} locale={locale} />
        )}
      </div>
    </div>
  );
}

function DhikrCounter() {
  const { language, isArabic, locale, text } = useI18n();
  const { dhikrHistory, recordDhikr } = useStore();
  const [kind, setKind] = useState<DhikrKind>('istighfar');
  const [session, setSession] = useState(0);
  const [focusLocked, setFocusLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const pending = useRef(0);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = dayKey();

  const flush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = null;
    const amount = pending.current;
    if (amount <= 0) return;
    pending.current = 0;
    recordDhikr(today, kind, amount);
  }, [kind, recordDhikr, today]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [flush]);

  useEffect(() => {
    document.body.style.overflow = focusLocked ? 'hidden' : '';
    let sentinel: { release: () => Promise<void> } | undefined;
    let active = true;
    if (focusLocked) {
      const wakeLock = (navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      }).wakeLock;
      void wakeLock?.request('screen').then((lock) => {
        if (active) sentinel = lock;
        else void lock.release();
      }).catch(() => undefined);
    }
    return () => {
      active = false;
      document.body.style.overflow = '';
      void sentinel?.release();
    };
  }, [focusLocked]);

  const increment = () => {
    const next = session + 1;
    pending.current += 1;
    setSession(next);
    haptic(next % 33 === 0 ? 'lock' : 'tick');
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, 450);
  };

  const chooseKind = (next: DhikrKind) => {
    flush();
    setKind(next);
    setSession(0);
    haptic('soft');
  };

  const newSession = () => {
    flush();
    setSession(0);
    haptic('soft');
  };

  const startUnlock = () => {
    setUnlocking(true);
    unlockTimer.current = setTimeout(() => {
      setFocusLocked(false);
      setUnlocking(false);
      haptic('lock');
    }, 1_200);
  };

  const cancelUnlock = () => {
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = null;
    setUnlocking(false);
  };

  const phrase = PHRASES[kind];
  const todayTotal = countFor(dhikrHistory[today], kind) + pending.current;
  const totals = useMemo(() => {
    const sum = (days: number) => Array.from({ length: days }, (_, i) =>
      countFor(dhikrHistory[shiftedDay(-i)], kind),
    ).reduce((total, value) => total + value, 0) + pending.current;
    return {
      week: sum(7),
      month: sum(30),
      year: sum(365),
      all: Object.values(dhikrHistory).reduce((total, counts) => total + countFor(counts, kind), 0) + pending.current,
    };
  }, [dhikrHistory, kind, session]);

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const key = shiftedDay(i - 6);
    return {
      key,
      value: countFor(dhikrHistory[key], kind) + (key === today ? pending.current : 0),
      label: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(`${key}T12:00:00`)),
    };
  }), [dhikrHistory, kind, locale, session, today]);
  const maxWeek = Math.max(1, ...week.map((day) => day.value));

  if (focusLocked) {
    return (
      <div className="focus-lock fixed inset-0 z-50 flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{text('Focus lock', 'وضع التركيز')}</p>
        <p className="mt-2 text-sm text-white/65">{isArabic ? phrase.ar : phrase.en}</p>
        <p className="tabular mt-4 text-6xl font-light text-white">{session}</p>
        <CounterButton phrase={isArabic ? phrase.ar : phrase.en} onPress={increment} locked />
        <p className="mt-7 max-w-xs text-xs leading-relaxed text-white/45">
          {text('Only the counter is active. Navigation and other controls are protected from accidental touches.', 'العداد وحده نشط. التنقل وبقية الأزرار محمية من اللمسات العرضية.')}
        </p>
        <button
          type="button"
          className={`hold-unlock${unlocking ? ' is-holding' : ''}`}
          onPointerDown={startUnlock}
          onPointerUp={cancelUnlock}
          onPointerCancel={cancelUnlock}
          onPointerLeave={cancelUnlock}
        >
          <LockIcon open={false} />
          <span>{text('Hold to unlock', 'اضغط مطولًا لإلغاء القفل')}</span>
          <span className="hold-unlock-progress" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <section className="pb-8 pt-5">
      <div className="grid grid-cols-4 gap-2 pb-1">
        {(Object.keys(PHRASES) as DhikrKind[]).map((id) => (
          <button
            type="button"
            key={id}
            onClick={() => chooseKind(id)}
            className={`dhikr-kind min-w-0${kind === id ? ' is-active' : ''}`}
          >
            {language === 'ar' ? PHRASES[id].shortAr : PHRASES[id].shortEn}
          </button>
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">{text('This session', 'هذه الجلسة')}</p>
        <p className="tabular mt-2 text-6xl font-light tracking-tight">{session.toLocaleString(locale)}</p>
        <p className="mt-2 text-sm text-[var(--ink-dim)]">{isArabic ? phrase.ar : phrase.en}</p>
      </div>

      <CounterButton phrase={isArabic ? phrase.ar : phrase.en} onPress={increment} />

      <div className="mt-7 flex items-center justify-center gap-3">
        <button type="button" onClick={() => { flush(); setFocusLocked(true); haptic('lock'); }} className="devotion-control">
          <LockIcon open={false} />
          {text('Focus lock', 'وضع التركيز')}
        </button>
        <button type="button" onClick={newSession} className="devotion-control">
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M16 6V2m0 0h-4m4 0l-3 3a6 6 0 10.8 8.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {text('New session', 'جلسة جديدة')}
        </button>
      </div>
      <p className="mx-auto mt-3 max-w-sm text-center text-[11px] leading-relaxed text-[var(--ink-faint)]">
        {text('Focus lock keeps only the counter active and asks for a long press to leave.', 'وضع التركيز يُبقي العداد وحده نشطًا ويتطلب ضغطة مطولة للخروج.')}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-[var(--card-line)] bg-[var(--card-line)]">
        <Metric label={text('Today', 'اليوم')} value={todayTotal} locale={locale} />
        <Metric label={text('Past 7 days', 'آخر 7 أيام')} value={totals.week} locale={locale} />
        <Metric label={text('Past 30 days', 'آخر 30 يومًا')} value={totals.month} locale={locale} />
        <Metric label={text('Past year', 'آخر سنة')} value={totals.year} locale={locale} />
      </div>

      <div className="card mt-3 rounded-3xl px-5 py-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">{text('Seven-day rhythm', 'إيقاع سبعة أيام')}</h2>
          <span className="tabular text-xs text-[var(--ink-faint)]">{text('All time', 'الإجمالي')} {totals.all.toLocaleString(locale)}</span>
        </div>
        <div className="mt-5 flex h-28 items-end gap-2" aria-label={text('Counts for the last seven days', 'أعداد آخر سبعة أيام')}>
          {week.map((day) => (
            <div key={day.key} className="flex flex-1 flex-col items-center gap-2">
              <span className="tabular text-[10px] text-[var(--ink-faint)]">{day.value || ''}</span>
              <span className="history-bar w-full rounded-t-full" style={{ height: `${Math.max(4, (day.value / maxWeek) * 76)}px` }} />
              <span className="text-[10px] text-[var(--ink-faint)]">{day.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CounterButton({ phrase, onPress, locked = false }: { phrase: string; onPress: () => void; locked?: boolean }) {
  const { text } = useI18n();
  return (
    <div className={`counter-plinth mx-auto mt-7${locked ? ' is-locked' : ''}`}>
      <button type="button" className="counter-button" onClick={onPress} aria-label={text(`Count ${phrase}`, `عدّ ${phrase}`)}>
        <span className="counter-button-rim" aria-hidden="true" />
        <span className="relative z-10 block text-[11px] uppercase tracking-[0.18em] opacity-60">{text('Tap to count', 'اضغط للعد')}</span>
        <span className="relative z-10 mt-2 block text-xl font-semibold">{phrase}</span>
        <span className="relative z-10 mt-3 block text-sm font-medium opacity-55">+1</span>
      </button>
    </div>
  );
}

function Metric({ label, value, locale }: { label: string; value: number; locale: string }) {
  return (
    <div className="bg-[var(--card)] px-4 py-4">
      <p className="text-[11px] text-[var(--ink-faint)]">{label}</p>
      <p className="tabular mt-1 text-2xl font-light">{value.toLocaleString(locale)}</p>
    </div>
  );
}

function Rituals({
  period,
  onPeriod,
  onOpenMulk,
  locale,
}: {
  period: RitualPeriod;
  onPeriod: (period: RitualPeriod) => void;
  onOpenMulk: () => void;
  locale: string;
}) {
  const { isArabic, text } = useI18n();
  const { ritualChecks, toggleRitual } = useStore();
  const today = dayKey();
  const checked = ritualChecks[today] ?? [];
  const items = period === 'morning' ? MORNING : EVENING;

  return (
    <section className="pb-8 pt-5">
      <Segmented
        label={text('Ritual period', 'وقت الأذكار')}
        value={period}
        onChange={onPeriod}
        size="compact"
        options={[
          { value: 'morning', label: text('Morning', 'الصباح') },
          { value: 'evening', label: text('Evening', 'المساء') },
          { value: 'mulk', label: text('Al-Mulk', 'الملك') },
        ]}
      />

      {period === 'mulk' ? (
        <div className="mulk-panel card mt-5 overflow-hidden rounded-[2rem]">
          <div className="mulk-sky px-6 pb-7 pt-8 text-center">
            <p className="arabic text-4xl text-[var(--accent)]">سورة الملك</p>
            <p className="mt-2 text-sm text-[var(--ink-dim)]">{text('Thirty verses · traditionally read at night', 'ثلاثون آية · تُقرأ تقليديًا في الليل')}</p>
          </div>
          <div className="px-6 pb-6">
            <h2 className="text-base font-semibold">{text('Its reported protection', 'ما ورد في فضلها')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-dim)]">
              {text(
                'A hadith graded hasan says this thirty-verse surah intercedes for a person until they are forgiven. Another report calls it the protector and rescuer from punishment of the grave; that particular chain is graded weak, so this is an encouraged nightly practice rather than a personal guarantee.',
                'ورد في حديث حسن أن هذه السورة ذات الثلاثين آية تشفع لصاحبها حتى يُغفر له. وتصفها رواية أخرى بأنها المانعة والمنجية من عذاب القبر، إلا أن سند تلك الرواية بعينه ضُعّف؛ لذا فهي عبادة ليلية مرغب فيها وليست ضمانًا شخصيًا.',
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--ink-faint)]">
              <a href="https://sunnah.com/tirmidhi/45/17" target="_blank" rel="noreferrer" className="source-chip">Tirmidhi 2891 · Hasan</a>
              <a href="https://sunnah.com/tirmidhi/45" target="_blank" rel="noreferrer" className="source-chip">Tirmidhi 2890 · weak chain</a>
            </div>
            <button type="button" onClick={onOpenMulk} className="mulk-open mt-6 w-full">
              <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M3.5 4.5h8a3 3 0 013 3v8h-8a3 3 0 01-3-3v-8zM6.5 4.5v11M14.5 7.5h2v8h-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {text('Open Surah Al-Mulk', 'فتح سورة الملك')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {period === 'morning' ? text('Morning adhkar', 'أذكار الصباح') : text('Evening adhkar', 'أذكار المساء')}
              </h2>
              <p className="mt-1 text-xs text-[var(--ink-dim)]">
                {text('Tap each item when you complete it.', 'اضغط على كل ذكر بعد إتمامه.')}
              </p>
            </div>
            <span className="tabular text-sm text-[var(--ink-faint)]">{checked.filter((id) => id.startsWith(period)).length}/{items.length}</span>
          </div>

          <div className="mt-4 divide-y divide-[var(--card-line)] border-y border-[var(--card-line)]">
            {items.map((item, index) => {
              const done = checked.includes(item.id);
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => { toggleRitual(today, item.id); haptic(done ? 'soft' : 'tick'); }}
                  className={`ritual-row w-full py-4 text-start${done ? ' is-done' : ''}`}
                  style={{ '--ritual-index': index } as React.CSSProperties}
                >
                  <span className="ritual-check" aria-hidden="true">
                    {done && <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8.3l3 3L13 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{isArabic ? item.titleAr : item.titleEn}</span>
                    <span className={`${isArabic ? 'arabic text-[15px]' : 'text-[12px]'} mt-1 block leading-relaxed text-[var(--ink-dim)]`}>
                      {isArabic ? item.detailAr : item.detailEn}
                    </span>
                    <span className="mt-1.5 block text-[10px] text-[var(--ink-faint)]">{item.source}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-[var(--accent)]">{isArabic ? item.countAr : item.countEn}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-[var(--ink-faint)]">
            {text(
              `Completion resets with each local day. Today is ${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(new Date())}.`,
              `تُعاد قائمة الإنجاز مع بداية كل يوم محلي. اليوم ${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(new Date())}.`,
            )}
          </p>
        </>
      )}
    </section>
  );
}

function LockIcon({ open }: { open: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="8" width="12" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d={open ? 'M7 8V6a3 3 0 016 0' : 'M7 8V6a3 3 0 016 0v2'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="12.5" r="1" fill="currentColor" />
    </svg>
  );
}
