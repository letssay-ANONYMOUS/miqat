import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';

/**
 * The daily remembrance card.
 *
 * Content note, deliberate: this ships **adhkar only** — the standard
 * remembrance formulas, plus one Qur'anic verse carried with its exact
 * reference. No hadith texts, because a hadith needs its wording and its
 * attribution to be right, and an app that prints one slightly wrong is
 * spreading error rather than reward. Those go in when they come from a source
 * that has been checked, not from memory.
 */

interface Dhikr {
  arabic: string;
  transliteration: string;
  meaning: string;
  meaningAr: string;
  note?: string;
}

const ADHKAR: Dhikr[] = [
  {
    arabic: 'سُبْحَانَ اللهِ وَبِحَمْدِهِ، سُبْحَانَ اللهِ الْعَظِيمِ',
    transliteration: 'Subḥān Allāhi wa biḥamdih, subḥān Allāhi l-ʿaẓīm',
    meaning: 'Glory be to Allah and praise Him; glory be to Allah the Most Great.',
    meaningAr: 'سبحان الله وبحمده، سبحان الله العظيم.',
  },
  {
    arabic: 'لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ',
    transliteration: 'Lā ilāha illā Llāhu waḥdahu lā sharīka lah',
    meaning: 'There is no god but Allah alone, without partner.',
    meaningAr: 'لا معبود بحق إلا الله وحده لا شريك له.',
  },
  {
    arabic: 'أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ',
    transliteration: 'Astaghfiru Llāha wa atūbu ilayh',
    meaning: 'I seek Allah’s forgiveness and turn to Him in repentance.',
    meaningAr: 'أطلب مغفرة الله وأتوب إليه.',
  },
  {
    arabic: 'سُبْحَانَ اللهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللهُ، وَاللهُ أَكْبَرُ',
    transliteration: 'Subḥān Allāh, wa l-ḥamdu lillāh, wa lā ilāha illā Llāh, wa Llāhu akbar',
    meaning: 'Glory be to Allah, praise be to Allah, there is no god but Allah, and Allah is the Greatest.',
    meaningAr: 'سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر.',
  },
  {
    arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللهِ',
    transliteration: 'Lā ḥawla wa lā quwwata illā billāh',
    meaning: 'There is no might nor power except with Allah.',
    meaningAr: 'لا تحول من حال إلى حال ولا قوة إلا بالله.',
  },
  {
    arabic: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ',
    transliteration: 'Allāhumma ṣalli wa sallim ʿalā nabiyyinā Muḥammad',
    meaning: 'O Allah, send blessings and peace upon our Prophet Muhammad.',
    meaningAr: 'اللهم صل وسلم على نبينا محمد.',
  },
  {
    arabic: 'حَسْبِيَ اللهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
    transliteration: 'Ḥasbiya Llāhu lā ilāha illā huw, ʿalayhi tawakkaltu wa huwa rabbu l-ʿarshi l-ʿaẓīm',
    meaning:
      'Allah is sufficient for me; there is no god but Him. In Him I put my trust, and He is the Lord of the Mighty Throne.',
    meaningAr: 'الله كافيني، لا إله إلا هو، عليه توكلت وهو رب العرش العظيم.',
    note: 'Qur’an 9:129',
  },
];

const DWELL_MS = 14_000;

export function DailyWidget() {
  const { isArabic, text } = useI18n();
  // Start on the one that belongs to today, so it is the same all day.
  const [index, setIndex] = useState(() => {
    const day = Math.floor(Date.now() / 86_400_000);
    return day % ADHKAR.length;
  });
  /** Bumped on every change so the enter animation always starts at 0%, not mid-run. */
  const [gen, setGen] = useState(0);

  const advance = useCallback((step = 1) => {
    setIndex((i) => (i + step + ADHKAR.length) % ADHKAR.length);
    setGen((n) => n + 1);
  }, []);

  // Restart the dwell from the beginning whenever the dua changes (tap or auto).
  useEffect(() => {
    const id = setInterval(() => advance(1), DWELL_MS);
    return () => clearInterval(id);
  }, [advance, index]);

  const dhikr = ADHKAR[index];

  return (
    <section className="card mt-3 overflow-hidden rounded-3xl">
      <button
        onClick={() => advance(1)}
        className="widget-press block w-full px-5 py-5 text-start"
        aria-label={text('Next remembrance', 'الذكر التالي')}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            {text('Dhikr', 'ذكر')}
          </span>
          <span className="flex gap-1.5" aria-hidden="true">
            {ADHKAR.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i === index ? 'w-4 bg-[var(--accent)]' : 'w-1 bg-[var(--ink-faint)] opacity-50'
                }`}
              />
            ))}
          </span>
        </div>

        <div key={gen} className={gen > 0 ? 'widget-enter' : undefined}>
          <p className="arabic mt-3 text-[1.6rem] leading-[1.9] sm:text-[1.85rem]">{dhikr.arabic}</p>
          <p className="mt-2 text-[13px] italic leading-relaxed text-[var(--ink-dim)]">
            {isArabic ? text('Meaning', 'المعنى') : dhikr.transliteration}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-dim)]">
            {isArabic ? dhikr.meaningAr : dhikr.meaning}
            {dhikr.note && <span className="ms-1.5 opacity-80">· {isArabic ? 'القرآن 9:129' : dhikr.note}</span>}
          </p>
        </div>
      </button>
    </section>
  );
}
