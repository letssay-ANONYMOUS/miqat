/**
 * A soft bell for prayer times, synthesised on the spot.
 *
 * Deliberately not a recorded adhan: every recording of one is somebody's
 * performance and carries their rights, so shipping one with the app would be
 * using their work without permission. This is a few oscillators instead —
 * nothing to download, nothing to license, and about a hundred bytes of code.
 *
 * Browsers refuse to start audio until the user has interacted with the page,
 * which is why the settings panel has a Test button: pressing it unlocks the
 * context for the rest of the session.
 */

let context: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** One struck note: a fundamental plus two quieter partials, decaying away. */
function strike(ctx: AudioContext, frequency: number, at: number, gain: number) {
  const partials = [
    { ratio: 1, level: 1, decay: 2.6 },
    { ratio: 2.01, level: 0.34, decay: 1.7 },
    { ratio: 3.02, level: 0.14, decay: 1.1 },
  ];

  for (const partial of partials) {
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency * partial.ratio;

    const peak = gain * partial.level;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + partial.decay);

    oscillator.connect(envelope).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + partial.decay + 0.1);
  }
}

/** A rising three-note motif. `volume` is 0 to 1. */
export function playChime(volume = 0.6): void {
  const ctx = ensureContext();
  if (!ctx) return;

  const gain = Math.min(1, Math.max(0, volume)) * 0.22;
  if (gain <= 0) return;

  const start = ctx.currentTime + 0.03;
  // D5, F#5, A5 — an open major triad, calm rather than alarming.
  strike(ctx, 587.33, start, gain);
  strike(ctx, 739.99, start + 0.42, gain * 0.92);
  strike(ctx, 880.0, start + 0.84, gain * 0.85);
}

export const soundSupported =
  typeof window !== 'undefined' &&
  Boolean(window.AudioContext ?? (window as { webkitAudioContext?: unknown }).webkitAudioContext);
