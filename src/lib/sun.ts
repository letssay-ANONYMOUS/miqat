/**
 * Where the sun actually is, right now, from here.
 *
 * The board's colours and the sun in the background are driven by this rather
 * than by a clock, so the light on screen tracks the light outside: it climbs
 * through the morning, sits highest a little after Dhuhr, sinks through Asr,
 * reddens at Maghrib and is gone by Isha — at the right times for the latitude,
 * in December as well as June.
 *
 * Standard low-precision solar position (NOAA). Good to a fraction of a degree,
 * which is far past what a background needs, and it costs a few trig calls.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface SunPosition {
  /** Degrees above the horizon; negative when set. */
  altitude: number;
  /** Degrees clockwise from true north. */
  azimuth: number;
  /** Degrees from the meridian: negative before solar noon, positive after. */
  hourAngle: number;
}

export function sunPosition(date: Date, latitude: number, longitude: number): SunPosition {
  const days = date.getTime() / 86_400_000 - 10_957.5; // days since J2000.0

  const meanLongitude = (280.46 + 0.9856474 * days) % 360;
  const meanAnomaly = (357.528 + 0.9856003 * days) * RAD;
  const eclipticLongitude =
    (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;
  const obliquity = (23.439 - 0.0000004 * days) * RAD;

  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );

  // Greenwich mean sidereal time, then the local hour angle.
  const gmst = (280.46061837 + 360.98564736629 * days) % 360;
  let hourAngle = (gmst + longitude - rightAscension * DEG) % 360;
  if (hourAngle > 180) hourAngle -= 360;
  if (hourAngle < -180) hourAngle += 360;

  const lat = latitude * RAD;
  const ha = hourAngle * RAD;

  const altitude =
    Math.asin(
      Math.sin(lat) * Math.sin(declination) +
        Math.cos(lat) * Math.cos(declination) * Math.cos(ha),
    ) * DEG;

  const azimuth =
    (Math.atan2(
      Math.sin(ha),
      Math.cos(ha) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat),
    ) *
      DEG +
      180) %
    360;

  return { altitude, azimuth, hourAngle };
}

export interface SkyPlacement {
  /** Percentage across the sky, 0 at the eastern edge. */
  x: number;
  /** Percentage down the viewport; the horizon sits at 72. */
  y: number;
  /** How far above the horizon, 0 at and below it, 1 at the zenith. */
  daylight: number;
}

const HORIZON_Y = 72;

/**
 * The hour angle carries the sun across the screen and the altitude lifts it,
 * so the arc is genuinely flatter in winter and steeper in summer instead of
 * being the same painted curve every day.
 */
export function placeInSky({ altitude, hourAngle }: SunPosition): SkyPlacement {
  const x = clamp(50 + (hourAngle / 150) * 50, 2, 98);
  const y =
    altitude >= 0
      ? HORIZON_Y - (altitude / 90) * (HORIZON_Y - 6)
      : HORIZON_Y + clamp(-altitude / 24, 0, 1) * 26;

  return { x, y, daylight: clamp(altitude / 90, 0, 1) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
