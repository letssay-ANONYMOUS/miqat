import { useEffect, useMemo, useRef, useState } from 'react';
import { loadQuran, type QuranBundle, type Surah } from '../lib/quran';
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
  const { quranShowEnglish, setQuranShowEnglish, setQuranBookmark } = useStore();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuranBookmark({ surah: surah.n, ayah: startAyah });
    const node = scroller.current?.querySelector(`[data-ayah="${startAyah}"]`);
    if (startAyah > 1) node?.scrollIntoView({ block: 'center' });
  }, [surah.n, startAyah, setQuranBookmark]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const nodes = [...root.querySelectorAll<HTMLElement>('[data-ayah]')];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const ayah = Number(visible[0]?.target.getAttribute('data-ayah'));
        if (ayah) setQuranBookmark({ surah: surah.n, ayah });
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0.1 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [surah.n, setQuranBookmark]);

  return (
    <section className="flex flex-1 flex-col py-2">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="rounded-full px-3 py-1.5 text-sm text-[var(--ink-dim)] transition hover:bg-white/10"
        >
          ← Surahs
        </button>
        <button
          onClick={() => setQuranShowEnglish(!quranShowEnglish)}
          className="rounded-full px-3 py-1.5 text-sm text-[var(--ink-dim)] transition hover:bg-white/10"
        >
          {quranShowEnglish ? 'Arabic only' : 'Show English'}
        </button>
      </div>

      <header className="mt-3 px-1 text-center">
        <p className="arabic mushaf text-3xl leading-relaxed">{surah.name}</p>
        <p className="mt-1 text-sm text-[var(--ink-dim)]">
          {surah.n}. {surah.tname} · {surah.ename}
        </p>
        <p className="text-[12px] text-[var(--ink-faint)]">
          {surah.type} · {surah.ar.length} ayahs
        </p>
      </header>

      {surah.n !== 1 && surah.n !== 9 && (
        <p className="arabic mushaf mt-5 text-center text-[1.7rem] leading-[2.1] text-[var(--ink)]">
          {data.surahs[0].ar[0]}
        </p>
      )}

      <div ref={scroller} className="mt-4 space-y-5">
        {surah.ar.map((ar, i) => (
          <article key={i} data-ayah={i + 1} className="px-1">
            <p className="arabic mushaf text-[1.7rem] leading-[2.15]">
              {ar}
              <span className="ayah-mark tabular mx-1.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-[var(--card-line)] align-middle text-[11px] text-[var(--ink-dim)]">
                {i + 1}
              </span>
            </p>
            {quranShowEnglish && (
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-dim)]">{surah.en[i]}</p>
            )}
          </article>
        ))}
      </div>

      <nav className="mt-8 flex items-center justify-between gap-3 pb-2">
        {surah.n > 1 ? (
          <button
            onClick={() => onOpen(surah.n - 1)}
            className="card flex-1 rounded-2xl px-4 py-3 text-left text-sm"
          >
            <span className="block text-[11px] text-[var(--ink-faint)]">Previous</span>
            {data.surahs[surah.n - 2].tname}
          </button>
        ) : (
          <span className="flex-1" />
        )}
        {surah.n < 114 ? (
          <button
            onClick={() => onOpen(surah.n + 1)}
            className="card flex-1 rounded-2xl px-4 py-3 text-right text-sm"
          >
            <span className="block text-[11px] text-[var(--ink-faint)]">Next</span>
            {data.surahs[surah.n].tname}
          </button>
        ) : (
          <span className="flex-1" />
        )}
      </nav>
    </section>
  );
}
