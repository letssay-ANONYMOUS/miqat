import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RECITERS,
  ayahAudioUrl,
  globalAyahNumber,
  loadQuran,
  reciterById,
  type QuranBundle,
  type ReciterId,
  type Surah,
} from '../lib/quran';
import { useStore } from '../lib/store';

export function QuranPage() {
  const [data, setData] = useState<QuranBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<{ surah: number; ayah: number } | null>(null);

  useEffect(() => {
    let alive = true;
    loadQuran()
      .then((bundle) => {
        if (alive) setData(bundle);
      })
      .catch(() => {
        if (alive) setError('The Qur’an file could not be opened.');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return <p className="px-1 py-8 text-sm text-[var(--ink-dim)]">{error}</p>;
  }
  if (!data) {
    return <p className="px-1 py-8 text-sm text-[var(--ink-faint)]">Opening the mushaf…</p>;
  }

  if (open) {
    const surah = data.surahs[open.surah - 1];
    if (!surah) return null;
    return (
      <Reader
        data={data}
        surah={surah}
        startAyah={open.ayah}
        onBack={() => setOpen(null)}
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
    <section className="flex flex-1 flex-col py-3">
      <header className="px-1">
        <h1 className="text-2xl font-semibold tracking-tight">Qur’an</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-dim)]">
          Uthmani script from Tanzil, Hafs. The English is a translation, not the Qur’an.
        </p>
      </header>

      {marked && (
        <button
          onClick={() => onOpen(marked.n, bookmark!.ayah)}
          className="card mt-4 w-full rounded-3xl px-5 py-4 text-left"
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">Continue</p>
          <p className="mt-1 flex items-baseline justify-between gap-3">
            <span className="font-medium">
              {marked.tname}
              <span className="arabic mr-0 ml-2 text-[var(--accent)]">{marked.name}</span>
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
        placeholder="Search a surah"
        className="card mt-3 w-full rounded-2xl border-0 bg-[var(--card)] px-4 py-3 text-[15px] outline-none placeholder:text-[var(--ink-faint)]"
      />

      <ol className="card mt-3 divide-y divide-[var(--card-line)] overflow-hidden rounded-3xl">
        {list.map((s) => (
          <li key={s.n}>
            <button
              onClick={() => onOpen(s.n)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-white/8"
            >
              <span className="tabular w-7 shrink-0 text-[13px] text-[var(--ink-faint)]">{s.n}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{s.tname}</span>
                <span className="block text-[12px] text-[var(--ink-dim)]">
                  {s.ename} · {s.type} · {s.ar.length}
                </span>
              </span>
              <span className="arabic text-lg text-[var(--ink)]">{s.name}</span>
            </button>
          </li>
        ))}
      </ol>

      <p className="mt-4 px-1 text-[11px] leading-relaxed text-[var(--ink-faint)]">
        Arabic: Tanzil.net Uthmani, CC BY 3.0 — the wording is not edited.{' '}
        <a href="https://tanzil.net" className="underline underline-offset-4" target="_blank" rel="noreferrer">
          tanzil.net
        </a>
        . English: Saheeh International.
      </p>
    </section>
  );
}

function Reader({
  data,
  surah,
  startAyah,
  onBack,
  onOpen,
}: {
  data: QuranBundle;
  surah: Surah;
  startAyah: number;
  onBack: () => void;
  onOpen: (n: number) => void;
}) {
  const { quranReciter, setQuranReciter, setQuranBookmark } = useStore();
  const page = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [selected, setSelected] = useState(startAyah);
  const [playing, setPlaying] = useState(false);
  const playFrom = useRef<{ surah: number; ayah: number } | null>(null);

  const basmala = data.surahs[0].ar[0];
  const showBasmala = surah.n !== 1 && surah.n !== 9;

  useEffect(() => {
    document.body.classList.add('reading-mushaf');
    return () => document.body.classList.remove('reading-mushaf');
  }, []);

  useEffect(() => {
    setSelected(startAyah);
    setQuranBookmark({ surah: surah.n, ayah: startAyah });
    const node = page.current?.querySelector(`[data-ayah="${startAyah}"]`);
    if (startAyah > 1) node?.scrollIntoView({ block: 'center' });
  }, [surah.n, startAyah, setQuranBookmark]);

  useEffect(() => {
    return () => {
      audio.current?.pause();
      audio.current = null;
    };
  }, []);

  const reciter = reciterById(quranReciter);

  const play = (s: number, a: number, reciterId: ReciterId = reciter.id) => {
    const chapter = data.surahs[s - 1];
    if (!chapter || a < 1 || a > chapter.ar.length) {
      setPlaying(false);
      playFrom.current = null;
      return;
    }
    setSelected(a);
    setQuranBookmark({ surah: s, ayah: a });
    playFrom.current = { surah: s, ayah: a };
    const url = ayahAudioUrl(reciterId, globalAyahNumber(data, s, a));
    if (!audio.current) {
      audio.current = new Audio();
      audio.current.preload = 'auto';
      audio.current.setAttribute('playsinline', '');
    }
    const el = audio.current;
    el.pause();
    el.src = url;
    el.onended = () => {
      const nextA = a + 1;
      if (nextA <= chapter.ar.length) play(s, nextA, reciterId);
      else {
        setPlaying(false);
        playFrom.current = null;
      }
    };
    el.onerror = () => setPlaying(false);
    void el.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  };

  const stop = () => {
    audio.current?.pause();
    setPlaying(false);
    playFrom.current = null;
  };

  const onReciter = (id: ReciterId) => {
    setQuranReciter(id);
    if (playing && playFrom.current) {
      const at = playFrom.current;
      play(at.surah, at.ayah, id);
    }
  };

  return (
    <div ref={page} className="mushaf-page">
      <header className="mushaf-chrome">
        <button type="button" className="mushaf-back" onClick={onBack} aria-label="Surahs">
          ←
        </button>
        <h1 className="arabic mushaf-title">{`سورة ${surah.name}`}</h1>
        <span className="mushaf-chrome-meta tabular">
          {surah.n}
        </span>
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
            const now = playing && playFrom.current?.surah === surah.n && playFrom.current.ayah === n;
            return (
              <span
                key={n}
                data-ayah={n}
                className={`mushaf-ayah${on ? ' is-on' : ''}${now ? ' is-playing' : ''}`}
                onClick={() => {
                  setSelected(n);
                  setQuranBookmark({ surah: surah.n, ayah: n });
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

      <div className="mushaf-tray">
        <div className="mushaf-tray-row">
          <p className="tabular text-[12px] text-[#6b5740]">
            {surah.n}:{selected}
          </p>
          <select
            className="mushaf-reciter"
            value={reciter.id}
            aria-label="Reciter"
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
            onClick={() => (playing ? stop() : play(surah.n, selected))}
          >
            {playing ? 'Pause' : 'Recite'}
          </button>
        </div>
        <p className="mushaf-tray-en">{surah.en[selected - 1]}</p>
        <p className="mushaf-tray-note">Saheeh International · translation, not the Qur’an</p>
      </div>
    </div>
  );
}
