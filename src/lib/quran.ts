export interface Surah {
  n: number;
  name: string;
  tname: string;
  ename: string;
  type: 'Meccan' | 'Medinan';
  ar: string[];
  en: string[];
}

export interface QuranBundle {
  source: string;
  arabic: string;
  translation: string;
  license: string;
  surahs: Surah[];
}

export type QuranBookmark = { surah: number; ayah: number };

let bundle: Promise<QuranBundle> | null = null;

/** Loaded on demand so the prayer pages do not pay for 2 MB of text. */
export function loadQuran(): Promise<QuranBundle> {
  bundle ??= import('../data/quran.json').then((mod) => mod.default as QuranBundle);
  return bundle;
}


