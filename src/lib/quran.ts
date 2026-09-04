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

/** 1-based index across the whole mushaf (1…6236). */
export function globalAyahNumber(data: QuranBundle, surah: number, ayah: number): number {
  let n = 0;
  for (let i = 0; i < surah - 1; i += 1) n += data.surahs[i].ar.length;
  return n + ayah;
}

export const RECITERS = [
  { id: 'ar.alafasy', name: 'Mishary Alafasy', ar: 'مشاري العفاسي', bit: 128 },
  { id: 'ar.abdulbasitmurattal', name: 'Abdul Basit', ar: 'عبد الباسط', bit: 192 },
  { id: 'ar.husary', name: 'Al-Husary', ar: 'الحصري', bit: 128 },
  { id: 'ar.minshawi', name: 'Al-Minshawi', ar: 'المنشاوي', bit: 128 },
  { id: 'ar.mahermuaiqly', name: 'Maher Al Muaiqly', ar: 'ماهر المعيقلي', bit: 128 },
  { id: 'ar.abdurrahmaansudais', name: 'As-Sudais', ar: 'السديس', bit: 192 },
] as const;

export type ReciterId = (typeof RECITERS)[number]['id'];

export function reciterById(id: string) {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0];
}

export function ayahAudioUrl(reciter: ReciterId, global: number): string {
  const r = reciterById(reciter);
  return `https://cdn.islamic.network/quran/audio/${r.bit}/${r.id}/${global}.mp3`;
}

let bundle: Promise<QuranBundle> | null = null;

/** Loaded on demand so the prayer pages do not pay for 2 MB of text. */
export function loadQuran(): Promise<QuranBundle> {
  bundle ??= import('../data/quran.json').then((mod) => mod.default as QuranBundle);
  return bundle;
}


