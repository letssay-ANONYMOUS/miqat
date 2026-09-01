import type { Place } from './geo';

/**
 * A tap-to-pick list for the UAE, so nobody has to type or hand over GPS to get
 * the right times. Coordinates are the town centres; elevation is included
 * because the inland towns are genuinely high enough to matter if the horizon
 * correction is ever switched on.
 */
interface UaePlace {
  name: string;
  emirate: string;
  latitude: number;
  longitude: number;
  elevation: number;
}

export const UAE_EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
] as const;

export const UAE_PLACES: UaePlace[] = [
  { name: 'Abu Dhabi', emirate: 'Abu Dhabi', latitude: 24.4539, longitude: 54.3773, elevation: 5 },
  { name: 'Al Ain', emirate: 'Abu Dhabi', latitude: 24.1917, longitude: 55.7606, elevation: 275 },
  { name: 'Madinat Zayed', emirate: 'Abu Dhabi', latitude: 23.6547, longitude: 53.7028, elevation: 100 },
  { name: 'Ruwais', emirate: 'Abu Dhabi', latitude: 24.1103, longitude: 52.7306, elevation: 5 },
  { name: 'Liwa', emirate: 'Abu Dhabi', latitude: 23.1333, longitude: 53.7833, elevation: 130 },
  { name: 'Ghayathi', emirate: 'Abu Dhabi', latitude: 23.8419, longitude: 52.8103, elevation: 60 },
  { name: 'Mirfa', emirate: 'Abu Dhabi', latitude: 24.1167, longitude: 53.4833, elevation: 5 },
  { name: 'Delma Island', emirate: 'Abu Dhabi', latitude: 24.5089, longitude: 52.3308, elevation: 5 },
  { name: 'Al Sila', emirate: 'Abu Dhabi', latitude: 24.0703, longitude: 51.7906, elevation: 5 },

  { name: 'Dubai', emirate: 'Dubai', latitude: 25.2048, longitude: 55.2708, elevation: 5 },
  { name: 'Jebel Ali', emirate: 'Dubai', latitude: 25.0111, longitude: 55.0611, elevation: 5 },
  { name: 'Hatta', emirate: 'Dubai', latitude: 24.7997, longitude: 56.1219, elevation: 300 },

  { name: 'Sharjah', emirate: 'Sharjah', latitude: 25.3463, longitude: 55.4209, elevation: 15 },
  { name: 'Khor Fakkan', emirate: 'Sharjah', latitude: 25.3392, longitude: 56.3419, elevation: 10 },
  { name: 'Kalba', emirate: 'Sharjah', latitude: 25.0697, longitude: 56.3506, elevation: 8 },
  { name: 'Dhaid', emirate: 'Sharjah', latitude: 25.2872, longitude: 55.8817, elevation: 100 },

  { name: 'Ajman', emirate: 'Ajman', latitude: 25.4052, longitude: 55.5136, elevation: 5 },
  { name: 'Masfout', emirate: 'Ajman', latitude: 24.8069, longitude: 56.0369, elevation: 320 },

  { name: 'Umm Al Quwain', emirate: 'Umm Al Quwain', latitude: 25.5647, longitude: 55.5552, elevation: 3 },

  { name: 'Ras Al Khaimah', emirate: 'Ras Al Khaimah', latitude: 25.7895, longitude: 55.9432, elevation: 5 },
  { name: 'Al Rams', emirate: 'Ras Al Khaimah', latitude: 25.8778, longitude: 56.0439, elevation: 5 },

  { name: 'Fujairah', emirate: 'Fujairah', latitude: 25.1288, longitude: 56.3265, elevation: 10 },
  { name: 'Dibba Al-Fujairah', emirate: 'Fujairah', latitude: 25.5925, longitude: 56.2611, elevation: 10 },
  { name: 'Masafi', emirate: 'Fujairah', latitude: 25.2986, longitude: 56.1583, elevation: 250 },
];

export function uaePlaceToPlace(entry: UaePlace): Place {
  return {
    name: entry.name,
    admin: entry.emirate,
    country: 'United Arab Emirates',
    countryCode: 'AE',
    latitude: entry.latitude,
    longitude: entry.longitude,
    timezone: 'Asia/Dubai',
    elevation: entry.elevation,
    source: 'manual',
  };
}
