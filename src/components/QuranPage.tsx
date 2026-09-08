import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RECITERS,
  loadQuran,
  reciterById,
  type QuranBundle,
  type ReciterId,
  type Surah,
} from '../lib/quran';
import { playAyah, stopAyah } from '../lib/recite';
import { useStore } from '../lib/store';
import { useI18n } from '../lib/i18n';

export function QuranPage({
  onReading,
  openRequest,
}: {
  onReading?: (reading: boolean) => void;
  openRequest?: { surah: number; token: number } | null;
}) {
  const { text } = useI18n();
  const [data, setData] = useState<QuranBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<{ surah: number; ayah: number } | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!openRequest) return;
    setLeaving(false);
    setOpen({ surah: openRequest.surah, ayah: 1 });
  }, [openRequest?.token, openRequest?.surah]);

  useEffect(() => {
    let alive = true;
    loadQuran()
      .then((bundle) => {
        if (alive) setData(bundle);
      })
      .catch(() => {
        if (alive) setError(text('The Qur’an file could not be opened.', 'تعذر فتح ملف القرآن الكريم.'));
      });
    return () => {
      alive = false;
    };
  }, [text]);

  if (error) {
    return <p className="px-1 py-8 text-sm text-[var(--ink-dim)]">{error}</p>;
  }
  if (!data) {
    return <p className="px-1 py-8 text-sm text-[var(--ink-faint)]">{text('Opening the mushaf…', 'جارٍ فتح المصحف…')}</p>;
  }

  if (open) {
    const surah = data.surahs[open.surah - 1];
    if (!surah) return null;
    return (
      <Reader
        data={data}
        surah={surah}
        startAyah={open.ayah}
        leaving={leaving}
        onReading={onReading}
        onBack={() => {
          setLeaving(true);
          window.setTimeout(() => {
            setLeaving(false);
            setOpen(null);
            window.scrollTo(0, 0);
          }, 280);
        }}
        onOpen={(n) => setOpen({ surah: n, ayah: 1 })}
      />
    );
  }

  return (
    <Index
      data={data}
      query={query}
      setQuery={setQuery}
      onOpen={(n, ayah = 1) => setOpen({ surah: n, ayah })}
    />
  );
}

function Index({
  data,
  query,
  setQuery,
  onOpen,
}: {
  data: QuranBundle;
  query: string;
  setQuery: (q: string) => void;
  onOpen: (n: number, ayah?: number) => void;
}) {
  const bookmark = useStore((s) => s.quranBookmark);
  const { isArabic, text } = useI18n();
  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    if (!q) return data.surahs;
    return data.surahs.filter(
      (s) =>
        String(s.n) === q ||
        s.name.includes(query.trim()) ||
        s.tname.toLowerCase().includes(q) ||
        s.ename.toLowerCase().includes(q),
    );
  }, [data.surahs, q, query]);

  const marked = bookmark ? data.surahs[bookmark.surah - 1] : null;

  return (
    <section className="quran-index flex flex-1 flex-col py-3">
      <header className="px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{text('Qur’an', 'القرآن الكريم')}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-dim)]">
          {text('Uthmani script from Tanzil, Hafs. The English is a translation, not the Qur’an.', 'نص عثماني برواية حفص من تنزيل. النص الإنجليزي ترجمة للمعاني وليس قرآنًا.')}
        </p>
      </header>

      {marked && (
        <button
          onClick={() => onOpen(marked.n, bookmark!.ayah)}
          className="card mt-4 w-full rounded-3xl px-5 py-4 text-start"
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">{text('Continue', 'متابعة القراءة')}</p>
          <p className="mt-1 flex items-baseline justify-between gap-3">
            <span className="font-medium">
              {isArabic ? marked.name : marked.tname}
              <span className="arabic ms-2 text-[var(--accent)]">{isArabic ? marked.tname : marked.name}</span>
            </span>
            <span className="tabular text-[13px] text-[var(--ink-dim)]">
              {marked.n}:{bookmark!.ayah}
            </span>
          </p>
        </button>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={text('Search a surah', 'ابحث عن سورة')}
        className="card mt-3 w-full rounded-2xl border-0 bg-[var(--card)] px-4 py-3 text-[15px] outline-none placeholder:text-[var(--ink-faint)]"
      />

      <ol className="card mt-3 divide-y divide-[var(--card-line)] overflow-hidden rounded-3xl">
        {list.map((s) => (
          <li key={s.n}>
            <button
              onClick={() => onOpen(s.n)}
              className="flex w-full items-center gap-3 px-4 py-3 text-start transition active:bg-white/8"
            >
              <span className="tabular w-7 shrink-0 text-[13px] text-[var(--ink-faint)]">{s.n}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{isArabic ? s.name : s.tname}</span>
                <span className="block text-[12px] text-[var(--ink-dim)]">
                  {isArabic
                    ? `${s.tname} · ${s.type === 'Meccan' ? 'مكية' : 'مدنية'} · عدد الآيات: ${s.ar.length}`
                    : `${s.ename} · ${s.type} · ${s.ar.length}`}
                </span>
              </span>
              {!isArabic && <span className="arabic text-lg text-[var(--ink)]">{s.name}</span>}
            </button>
          </li>
        ))}
      </ol>

      <p className="mt-4 px-1 text-[11px] leading-relaxed text-[var(--ink-faint)]">
        {text('Arabic: Tanzil.net Uthmani, CC BY 3.0 — the wording is not edited.', 'العربية: النص العثماني من Tanzil.net بترخيص CC BY 3.0، ولم تُعدّل ألفاظه.')}{' '}
        <a href="https://tanzil.net" className="underline underline-offset-4" target="_blank" rel="noreferrer">
          tanzil.net
        </a>
        {text('. English: Saheeh International.', '. الإنجليزية: ترجمة صحيح إنترناشونال.')}
      </p>
    </section>
  );
}

function Reader({
  data,
  surah,
  startAyah,
  leaving,
  onBack,
  onOpen,
  onReading,
}: {
  data: QuranBundle;
  surah: Surah;
  startAyah: number;
  leaving: boolean;
  onBack: () => void;
  onOpen: (n: number) => void;
  onReading?: (reading: boolean) => void;
}) {
  const { quranReciter, setQuranReciter, setQuranBookmark } = useStore();
  const { isArabic, text } = useI18n();
  const dragY = useRef(0);
  const lastScroll = useRef(0);
  const [selected, setSelected] = useState(startAyah);
  const [playing, setPlaying] = useState(false);
  const [tray, setTray] = useState(false);
  const [chromeOn, setChromeOn] = useState(true);
  const playAt = useRef<{ surah: number; ayah: number } | null>(null);

  const basmala = data.surahs[0].ar[0];
  const showBasmala = surah.n !== 1 && surah.n !== 9;
  const reciter = reciterById(quranReciter);

  useEffect(() => {
    onReading?.(true);
    document.body.classList.add('reading-mushaf');
    document.body.classList.remove('show-app-chrome');
    const theme = document.querySelector('meta[name="theme-color"]');
    const prev = theme?.getAttribute('content') ?? '#080c1a';
    theme?.setAttribute('content', '#f3ead4');
    return () => {
      onReading?.(false);
      document.body.classList.remove('reading-mushaf', 'show-app-chrome');
      theme?.setAttribute('content', prev);
      stopAyah();
    };
  }, [onReading]);

  useEffect(() => {
    setSelected(startAyah);
    setQuranBookmark({ surah: surah.n, ayah: startAyah });
    if (startAyah > 1) {
      requestAnimationFrame(() => {
        document.querySelector(`[data-ayah="${startAyah}"]`)?.scrollIntoView({ block: 'start' });
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [surah.n, startAyah, setQuranBookmark]);

  useEffect(() => {
    lastScroll.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastScroll.current;
      lastScroll.current = y;
      if (y < 24) {
        setChromeOn(true);
        document.body.classList.remove('show-app-chrome');
        return;
      }
      if (dy > 6) {
        setChromeOn(false);
        document.body.classList.remove('show-app-chrome');
      } else if (dy < -6) {
        setChromeOn(true);
        document.body.classList.add('show-app-chrome');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const play = (a: number, reciterId: ReciterId = reciter.id) => {
    setSelected(a);
    setTray(true);
    setQuranBookmark({ surah: surah.n, ayah: a });
    playAt.current = { surah: surah.n, ayah: a };
    setPlaying(true);
    void playAyah({
      reciter: reciterId,
      surah: surah.n,
      ayah: a,
      onEnded: () => {
        setPlaying(false);
        playAt.current = null;
      },
    }).catch(() => {
      setPlaying(false);
      playAt.current = null;
    });
  };

  const stop = () => {
    stopAyah();
    setPlaying(false);
    playAt.current = null;
  };

  const onReciter = (id: ReciterId) => {
    setQuranReciter(id);
    if (playing) play(selected, id);
  };

  const pick = (n: number) => {
    setSelected(n);
    setTray(true);
    setQuranBookmark({ surah: surah.n, ayah: n });
  };

  return (
    <div className={`mushaf-page${leaving ? ' is-leaving' : ''}`}>
      <header className={`mushaf-chrome${chromeOn ? '' : ' is-away'}`}>
        <button type="button" className="mushaf-back" onClick={onBack} aria-label={text('Surahs', 'السور')}>
          {isArabic ? '→' : '←'}
        </button>
        <h1 className="arabic mushaf-title">{`سورة ${surah.name}`}</h1>
        <button
          type="button"
          className="mushaf-recite-toggle"
          aria-label={tray ? text('Hide reciter', 'إخفاء القارئ') : text('Show reciter', 'إظهار القارئ')}
          aria-pressed={tray}
          onClick={() => setTray((v) => !v)}
        >
          {tray ? '✕' : '♪'}
        </button>
      </header>

      <div className="mushaf-sheet">
        <div className="mushaf-surah-head">
          <span className="mushaf-surah-side">{surah.type === 'Meccan' ? 'مكية' : 'مدنية'}</span>
          <span className="arabic mushaf-surah-name">{surah.name}</span>
          <span className="mushaf-surah-side tabular">{surah.ar.length}</span>
        </div>

        {showBasmala && <p className="arabic mushaf-basmala">{basmala}</p>}

        <p className="arabic mushaf-body">
          {surah.ar.map((raw, i) => {
            const n = i + 1;
            const ar =
              n === 1 && showBasmala && raw.startsWith(basmala)
                ? raw.slice(basmala.length).trim()
                : raw;
            const on = selected === n;
            const now = playing && playAt.current?.ayah === n;
            return (
              <span
                key={n}
                data-ayah={n}
                className={`mushaf-ayah${on ? ' is-on' : ''}${now ? ' is-playing' : ''}`}
                onPointerDown={(e) => {
                  dragY.current = e.clientY;
                }}
                onPointerUp={(e) => {
                  if (Math.abs(e.clientY - dragY.current) > 10) return;
                  pick(n);
                }}
              >
                {ar}
                <span className="ayah-num" aria-hidden="true">
                  {n}
                </span>
              </span>
            );
          })}
        </p>

        <nav className="mushaf-turn">
          {surah.n < 114 ? (
            <button type="button" onClick={() => onOpen(surah.n + 1)}>
              {data.surahs[surah.n].name} ←
            </button>
          ) : (
            <span />
          )}
          {surah.n > 1 ? (
            <button type="button" onClick={() => onOpen(surah.n - 1)}>
              → {data.surahs[surah.n - 2].name}
            </button>
          ) : (
            <span />
          )}
        </nav>
      </div>

      {tray && (
      <div className="mushaf-tray">
        <div className="mushaf-tray-row">
          <p className="tabular text-[12px] text-[#6b5740]">
            {surah.n}:{selected}
          </p>
          <select
            className="mushaf-reciter"
            value={reciter.id}
            aria-label={text('Reciter', 'القارئ')}
            onChange={(e) => {
              const next = RECITERS.find((r) => r.id === e.target.value);
              if (next) onReciter(next.id);
            }}
          >
            {RECITERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="mushaf-play"
            onClick={() => (playing ? stop() : play(selected))}
          >
            {playing ? text('Pause', 'إيقاف مؤقت') : text('Recite this ayah', 'تلاوة هذه الآية')}
          </button>
        </div>
        <p className="mushaf-tray-en">{surah.en[selected - 1]}</p>
        <p className="mushaf-tray-note">{text('This ayah only · Saheeh International', 'هذه الآية فقط · ترجمة صحيح إنترناشونال')}</p>
        <button type="button" className="mushaf-tray-close" onClick={() => setTray(false)}>
          {text('Close', 'إغلاق')}
        </button>
      </div>
      )}
    </div>
  );
}
