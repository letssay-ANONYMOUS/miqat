import { useEffect, type RefObject } from 'react';

/**
 * Physical feedback: the rubber band at the ends of a scroll, and haptics.
 *
 * iOS already rubber-bands, and its version is better than anything reachable
 * from JavaScript — it runs on the compositor and survives a fling. So this
 * only takes over where the platform gives nothing, which is Android and
 * desktop. Fighting Safari for it would make the good case worse.
 */

const isIOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** Pixels of overscroll before the band engages at all. */
const THRESHOLD = 10;

/** Resistance curve: the further you pull, the less it gives. */
function damp(distance: number): number {
  const sign = Math.sign(distance);
  return sign * Math.min(110, Math.pow(Math.abs(distance), 0.72));
}

/**
 * The rubber band at the ends of a scroll.
 *
 * `source` matters and getting it wrong is fatal. A page-level container is not
 * itself a scroller — the window scrolls — so reading `scrollTop` off it always
 * returns 0, "already at the top" is always true, and every downward drag gets
 * preventDefault(). That is exactly how scrolling died on Android. The window
 * case therefore reads window.scrollY, and nothing is ever cancelled until the
 * pull has clearly passed a threshold at a real boundary.
 */
export function useRubberBand(
  ref: RefObject<HTMLElement | null>,
  source: 'window' | 'self' = 'window',
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || isIOS) return;

    const scrollTop = () => (source === 'window' ? window.scrollY : el.scrollTop);
    const maxScroll = () =>
      source === 'window'
        ? document.documentElement.scrollHeight - window.innerHeight
        : el.scrollHeight - el.clientHeight;

    let startY = 0;
    let engaged = false;

    const release = () => {
      if (!engaged) return;
      engaged = false;
      el.style.transition = 'transform 0.42s cubic-bezier(0.22, 1.2, 0.36, 1)';
      el.style.transform = '';
    };

    const onStart = (event: TouchEvent) => {
      startY = event.touches[0].clientY;
      engaged = false;
    };

    const onMove = (event: TouchEvent) => {
      if (document.body.classList.contains('reading-mushaf')) return;
      const dy = event.touches[0].clientY - startY;
      const top = scrollTop();
      const limit = maxScroll();

      // Only a real overscroll counts, and only past a threshold, so an
      // ordinary scroll is never intercepted.
      const beyondTop = dy > THRESHOLD && top <= 0;
      const beyondBottom = dy < -THRESHOLD && limit > 0 && top >= limit - 1;

      if (!beyondTop && !beyondBottom) {
        release();
        return;
      }

      engaged = true;
      el.style.transition = 'none';
      el.style.transform = `translateY(${damp(dy)}px)`;
      if (event.cancelable) event.preventDefault();
    };

    const target: HTMLElement | Window = source === 'window' ? window : el;
    target.addEventListener('touchstart', onStart as EventListener, { passive: true });
    target.addEventListener('touchmove', onMove as EventListener, { passive: false });
    target.addEventListener('touchend', release, { passive: true });
    target.addEventListener('touchcancel', release, { passive: true });

    return () => {
      target.removeEventListener('touchstart', onStart as EventListener);
      target.removeEventListener('touchmove', onMove as EventListener);
      target.removeEventListener('touchend', release);
      target.removeEventListener('touchcancel', release);
    };
  }, [ref, source]);
}

/**
 * A tap you can feel.
 *
 * Android exposes the Vibration API. WebKit does not expose Core Haptics, but
 * supported iPhone versions give their native switch control a small system
 * pulse, so that is used as a best-effort fallback during a real user tap.
 */
const switchHapticAvailable =
  isIOS &&
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('(-webkit-appearance: switch)');

export const hapticsAvailable =
  (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') ||
  switchHapticAvailable;

export type Haptic = 'tick' | 'lock' | 'soft';

const PATTERNS: Record<Haptic, number | number[]> = {
  tick: 8,
  soft: 16,
  lock: [14, 40, 22],
};

let nativeSwitch: HTMLInputElement | null = null;

function pulseNativeSwitch(): void {
  if (!switchHapticAvailable || typeof document === 'undefined') return;
  if (!nativeSwitch) {
    nativeSwitch = document.createElement('input');
    nativeSwitch.type = 'checkbox';
    nativeSwitch.setAttribute('switch', '');
    nativeSwitch.setAttribute('aria-hidden', 'true');
    nativeSwitch.tabIndex = -1;
    Object.assign(nativeSwitch.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '1px',
      height: '1px',
      opacity: '0.001',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    document.body.appendChild(nativeSwitch);
  }
  nativeSwitch.click();
}

export function haptic(kind: Haptic): void {
  if (!hapticsAvailable) return;
  try {
    if (typeof navigator.vibrate === 'function' && navigator.vibrate(PATTERNS[kind])) return;
    pulseNativeSwitch();
  } catch {
    // A refused pulse is never worth surfacing.
  }
}
