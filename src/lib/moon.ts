/**
 * Where the moon is in its cycle, right now.
 *
 * An Islamic app drawing a generic full moon every night is drawing a lie: the
 * Hijri month *is* this cycle. So the moon in the sky carries the real phase,
 * with the terminator on the correct side.
 *
 * Low-precision series (Meeus, chapter 49 form). Good to well under a degree of
 * phase angle, which is far past what a background needs.
 */

const RAD = Math.PI / 180;
/** Mean length of a lunation, in days. */
const SYNODIC_MONTH = 29.530588853;
/** A known new moon: 2000 January 6, 18:14 UTC. */
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) / 86_400_000;

export interface MoonPhase {
  /** 0 at new moon, 0.5 at full, approaching 1 back at new. */
  cycle: number;
  /** 0 dark, 1 fully lit. */
  illumination: number;
  /** True while growing — the lit limb is on the right in the north. */
  waxing: boolean;
  name: string;
}

function nameFor(cycle: number): string {
  if (cycle < 0.02 || cycle > 0.98) return 'New moon';
  if (cycle < 0.23) return 'Waxing crescent';
  if (cycle < 0.27) return 'First quarter';
  if (cycle < 0.48) return 'Waxing gibbous';
  if (cycle < 0.52) return 'Full moon';
  if (cycle < 0.73) return 'Waning gibbous';
  if (cycle < 0.77) return 'Last quarter';
  return 'Waning crescent';
}

export function moonPhase(date: Date): MoonPhase {
  const days = date.getTime() / 86_400_000 - KNOWN_NEW_MOON;
  const cycle = ((days / SYNODIC_MONTH) % 1 + 1) % 1;

  // Illuminated fraction follows the cosine of the phase angle.
  const illumination = (1 - Math.cos(cycle * 2 * Math.PI * 1)) / 2;

  return {
    cycle,
    illumination,
    waxing: cycle < 0.5,
    name: nameFor(cycle),
  };
}

/**
 * Geometry for drawing the terminator as two arcs.
 *
 * The lit limb is always a half-circle; the inner boundary is an ellipse whose
 * width shrinks to nothing at the quarters and inverts past them. Returning the
 * signed ratio lets a single path cover every phase.
 */
export function terminator(phase: MoonPhase): {
  sweep: number;
  innerSweep: number;
  rx: number;
} {
  /*
   * The lit shape is a semicircle joined to a half-ellipse. `ratio` is
   * cos(phase) = 1 − 2·illumination: negative past half, when the terminator
   * bulges outward and the moon is gibbous; positive before it, when the
   * terminator cuts inward and the moon is a crescent. That sign decides which
   * way the inner arc curves, and getting it backwards draws the complement —
   * a gibbous moon rendered as a thin crescent.
   */
  const ratio = Math.cos(phase.cycle * 2 * Math.PI);
  const sweep = phase.waxing ? 1 : 0;
  return {
    sweep,
    innerSweep: ratio < 0 ? sweep : 1 - sweep,
    rx: Math.abs(ratio) * 50,
  };
}

/** Fixed, plausible lunar detail — the same every night, as the real one is. */
export const CRATERS: { x: number; y: number; r: number; depth: number }[] = [
  { x: 34, y: 30, r: 11, depth: 0.16 },
  { x: 58, y: 24, r: 7, depth: 0.12 },
  { x: 68, y: 45, r: 13, depth: 0.14 },
  { x: 42, y: 55, r: 9, depth: 0.11 },
  { x: 26, y: 62, r: 6, depth: 0.1 },
  { x: 55, y: 72, r: 8, depth: 0.13 },
  { x: 74, y: 66, r: 5, depth: 0.09 },
  { x: 46, y: 40, r: 4, depth: 0.08 },
  { x: 62, y: 55, r: 3.5, depth: 0.07 },
  { x: 30, y: 45, r: 3, depth: 0.07 },
  { x: 50, y: 20, r: 3.5, depth: 0.06 },
  { x: 38, y: 74, r: 4, depth: 0.08 },
];

export const RAD_PER_DEGREE = RAD;
