/**
 * Which way the top of the phone is pointing.
 *
 * Derived from the device rotation matrix R = Rz(α)·Rx(β)·Ry(γ). The device's
 * +Y axis — out of the top edge of the screen — is column 1 of that matrix,
 * (−sinα·cosβ, cosα·cosβ, sinβ) in the earth frame, and the compass heading is
 * the atan2 of its east and north parts.
 *
 * That projection shrinks by cos β as the phone is tilted up, and vanishes when
 * the phone is upright: the top edge is then pointing at the sky, and α itself
 * becomes ill-conditioned (gimbal lock at β = 90°). So the magnitude that
 * survives the projection is reported as `level`, and the UI refuses to claim
 * accuracy when it is small. Hold the phone flat, like a compass.
 *
 * Two references exist and they are not interchangeable:
 *  - true north, which is what a bearing to the Kaaba is measured from;
 *  - magnetic north, where the magnetometer points, differing by the local
 *    declination — about 2° in the UAE, over 15° in parts of North America.
 *
 * iOS gives a true-north heading directly. Elsewhere we get magnetic and have
 * no declination model offline, so the app says so and offers the sun as an
 * exact correction (see `solarCalibration`).
 */

const DEG = Math.PI / 180;

export type HeadingReference = 'true' | 'magnetic' | 'unusable';

export interface Reading {
  degrees: number;
  reference: HeadingReference;
  /** 1 when flat, 0 when upright: how much of the heading survives the tilt. */
  level: number;
  /** The sensor's own claim in degrees; negative means it is unreliable. */
  accuracy: number | null;
}

interface OrientationEventIOS extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

/**
 * Compass heading of the phone's top edge, in degrees clockwise from whichever
 * north the sensor uses, plus how level the phone is. Returns null only when
 * the phone is close enough to vertical that the answer would be noise.
 */
export function headingFromAngles(
  alpha: number,
  beta: number,
  gamma: number,
): { degrees: number; level: number } | null {
  if (![alpha, beta, gamma].every(Number.isFinite)) return null;

  const a = alpha * DEG;
  const b = beta * DEG;

  const east = -Math.sin(a) * Math.cos(b);
  const north = Math.cos(a) * Math.cos(b);
  const level = Math.hypot(east, north);

  if (level < 0.08) return null; // within ~5° of vertical: gimbal lock

  return { degrees: (Math.atan2(east, north) / DEG + 360) % 360, level };
}

/** The OS rotates the page inside the device; undo that before pointing. */
export function screenAngle(): number {
  const angle =
    typeof screen !== 'undefined' && screen.orientation
      ? screen.orientation.angle
      : ((window as unknown as { orientation?: number }).orientation ?? 0);
  return ((angle ?? 0) + 360) % 360;
}

export function readingFrom(event: DeviceOrientationEvent): Reading | null {
  const ios = event as OrientationEventIOS;

  // iOS compensates for tilt and screen rotation itself, and references true
  // north whenever Location Services is on for the browser.
  if (typeof ios.webkitCompassHeading === 'number' && Number.isFinite(ios.webkitCompassHeading)) {
    const accuracy =
      typeof ios.webkitCompassAccuracy === 'number' ? ios.webkitCompassAccuracy : null;
    return {
      degrees: ios.webkitCompassHeading,
      reference: 'true',
      level: 1,
      accuracy,
    };
  }

  if (event.alpha === null || event.beta === null || event.gamma === null) return null;
  const solved = headingFromAngles(event.alpha, event.beta, event.gamma);
  if (!solved) return null;

  return {
    degrees: (solved.degrees + screenAngle() + 360) % 360,
    /*
     * `absolute` means the angles are referenced to the earth rather than to
     * however the device happened to be oriented when the page loaded. Without
     * it the value is not a compass at all — it is an arbitrary offset — so it
     * is reported as unusable rather than quietly drawn as a direction.
     */
    reference: event.absolute ? 'magnetic' : 'unusable',
    level: solved.level,
    accuracy: null,
  };
}

/**
 * The correction that turns a raw sensor heading into a true-north one, worked
 * out by pointing the phone at the sun.
 *
 * The sun's true azimuth follows from the time and the coordinates alone — no
 * magnetism involved — so aiming at it and recording what the compass claims
 * measures the sensor's entire error at once: declination, nearby metal, and
 * calibration drift together. Offline, this is the only way to be certain.
 */
export function solarCalibration(trueSunAzimuth: number, rawHeading: number): number {
  return normaliseSigned(trueSunAzimuth - rawHeading);
}

/** Smallest signed difference between two bearings, in (-180, 180]. */
export function normaliseSigned(degrees: number): number {
  let value = ((degrees + 180) % 360) - 180;
  if (value <= -180) value += 360;
  return value;
}

/** Ease one heading toward another the short way around the circle. */
export function lerpAngle(from: number, to: number, t: number): number {
  return (from + normaliseSigned(to - from) * t + 360) % 360;
}

/** Where to turn, described the way a person would say it. */
export function relativeTurn(from: number, to: number): { degrees: number; side: 'left' | 'right' } {
  const delta = normaliseSigned(to - from);
  return { degrees: Math.abs(Math.round(delta)), side: delta >= 0 ? 'right' : 'left' };
}
