import { useCallback } from 'react';
import { useStore } from './store';
import type { MethodKey } from './methods';

export type Language = 'en' | 'ar';

export function localize(language: Language, english: string, arabic: string): string {
  return language === 'ar' ? arabic : english;
}

export function localeFor(language: Language): string {
  // Latin digits keep prayer times compact and familiar across the UAE while
  // Intl still supplies Arabic weekday, month and day-period names.
  return language === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB';
}

const METHOD_LABEL_AR: Record<MethodKey, string> = {
  MuslimWorldLeague: 'رابطة العالم الإسلامي',
  Egyptian: 'الهيئة المصرية العامة للمساحة',
  Karachi: 'جامعة العلوم الإسلامية، كراتشي',
  UmmAlQura: 'جامعة أم القرى، مكة',
  Dubai: 'الإمارات — الأوقاف',
  Qatar: 'قطر',
  Kuwait: 'الكويت',
  Gulf: 'منطقة الخليج',
  MoonsightingCommittee: 'لجنة رؤية الهلال العالمية',
  NorthAmerica: 'ISNA — الجمعية الإسلامية لأمريكا الشمالية',
  Singapore: 'المجلس الإسلامي في سنغافورة',
  Jakim: 'جاكيم',
  Indonesia: 'وزارة الشؤون الدينية الإندونيسية',
  Turkey: 'رئاسة الشؤون الدينية التركية',
  Tehran: 'معهد الجيوفيزياء، جامعة طهران',
  Jafari: 'الشيعة الاثنا عشرية، معهد لواء، قم',
  France: 'اتحاد المنظمات الإسلامية في فرنسا',
  Russia: 'الإدارة الدينية لمسلمي روسيا',
  Tunisia: 'تونس',
  Algeria: 'الجزائر',
  Morocco: 'المغرب',
  Portugal: 'الجماعة الإسلامية في لشبونة',
  Jordan: 'وزارة الأوقاف الأردنية',
  Custom: 'زوايا مخصصة',
};

export function methodLabel(language: Language, key: MethodKey, fallback: string): string {
  return language === 'ar' ? METHOD_LABEL_AR[key] : fallback;
}

export function methodSummary(language: Language, summary: string): string {
  if (language !== 'ar') return summary;
  return summary
    .replaceAll('Fajr', 'الفجر')
    .replaceAll('Isha', 'العشاء')
    .replaceAll('Maghrib', 'المغرب')
    .replaceAll('Awqaf offsets', 'فروق الأوقاف')
    .replaceAll('seasonal correction', 'تصحيح موسمي')
    .replaceAll('min after', 'دقيقة بعد')
    .replaceAll('Your own parameters', 'معاييرك الخاصة');
}

export function useI18n() {
  const language = useStore((state) => state.settings.language);
  const text = useCallback(
    (english: string, arabic: string) => localize(language, english, arabic),
    [language],
  );
  return {
    language,
    locale: localeFor(language),
    isArabic: language === 'ar',
    text,
    methodLabel: (key: MethodKey, fallback: string) => methodLabel(language, key, fallback),
    methodSummary: (summary: string) => methodSummary(language, summary),
  };
}
