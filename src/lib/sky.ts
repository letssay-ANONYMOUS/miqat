/**
 * The sky's colour as a continuous function of how high the sun is.
 *
 * Interpolating between a handful of measured-looking stops gives a sky that
 * changes all day instead of snapping between five canned "themes" — the blue
 * deepens as the sun climbs toward Dhuhr, warms through Asr, burns at Maghrib
 * and goes out by Isha, with every minute in between actually drawn.
 *
 * The readable UI colours are *not* interpolated. Fading ink from white to
 * black would pass through a grey that is unreadable on both; instead the whole
 * ink set flips once, low in the sky, and CSS transitions cross-fade it.
 */

interface Stop {
  altitude: number;
  top: string;
  bottom: string;
  glow: string;
  sunCore: string;
  sunHalo: string;
}

const STOPS: Stop[] = [
  {
    altitude: -90,
    top: '#04060d',
    bottom: '#0c1322',
    glow: '#1b2846',
    sunCore: '#e6ecff',
    sunHalo: '#8fa8de',
  },
  {
    altitude: -14,
    top: '#080d26',
    bottom: '#1d2145',
    glow: '#3a3768',
    sunCore: '#ffd9c0',
    sunHalo: '#7d5a86',
  },
  {
    altitude: -6,
    top: '#14184a',
    bottom: '#5c3559',
    glow: '#9a4f63',
    sunCore: '#ffcda4',
    sunHalo: '#c2607a',
  },
  {
    altitude: -0.8,
    top: '#28306b',
    bottom: '#c96a4c',
    glow: '#ff9257',
    sunCore: '#fff0d2',
    sunHalo: '#ff8f52',
  },
  {
    altitude: 4,
    top: '#3f6aa8',
    bottom: '#eda875',
    glow: '#ffc389',
    sunCore: '#fffaf0',
    sunHalo: '#ffb063',
  },
  {
    altitude: 14,
    top: '#2f7cc4',
    bottom: '#c3dff2',
    glow: '#ffe6bd',
    sunCore: '#ffffff',
    sunHalo: '#ffd89a',
  },
  {
    altitude: 40,
    top: '#1f6cc6',
    bottom: '#bfe0f7',
    glow: '#ffffff',
    sunCore: '#ffffff',
    sunHalo: '#fff0c8',
  },
  {
    altitude: 90,
    top: '#1560bd',
    bottom: '#c8e6fb',
    glow: '#ffffff',
    sunCore: '#ffffff',
    sunHalo: '#fff6dc',
  },
];

/** Above this the page switches to dark ink on a light sky. */
const LIGHT_UI_ABOVE = 3;

export interface SkyPaint {
  top: string;
  bottom: string;
  glow: string;
  sunCore: string;
  sunHalo: string;
  lightUi: boolean;
  /** 0 while the sun is up, 1 once it is well below — drives the star field. */
  starOpacity: number;
  /** 0 by day, 1 deep at night — the moon takes over from the sun. */
  moonlit: number;
  /** The sun sinks out of sight rather than glowing on through the night. */
  sunOpacity: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const channel = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${channel(r1, r2)} ${channel(g1, g2)} ${channel(b1, b2)})`;
}

export function skyFor(altitude: number): SkyPaint {
  let lower = STOPS[0];
  let upper = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i += 1) {
    if (altitude >= STOPS[i].altitude && altitude <= STOPS[i + 1].altitude) {
      lower = STOPS[i];
      upper = STOPS[i + 1];
      break;
    }
  }

  const span = upper.altitude - lower.altitude;
  const t = span === 0 ? 0 : clamp((altitude - lower.altitude) / span, 0, 1);
  // Ease so the fast-moving twilight stops do not read as a linear wipe.
  const eased = t * t * (3 - 2 * t);

  return {
    top: mix(lower.top, upper.top, eased),
    bottom: mix(lower.bottom, upper.bottom, eased),
    glow: mix(lower.glow, upper.glow, eased),
    sunCore: mix(lower.sunCore, upper.sunCore, eased),
    sunHalo: mix(lower.sunHalo, upper.sunHalo, eased),
    lightUi: altitude > LIGHT_UI_ABOVE,
    starOpacity: clamp((-altitude - 2) / 10, 0, 1),
    moonlit: clamp((-altitude - 6) / 6, 0, 1),
    sunOpacity: clamp((altitude + 6) / 8, 0, 1),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
