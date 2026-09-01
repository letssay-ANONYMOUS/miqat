import { useEffect, useMemo, useRef, useState } from 'react';
import { placeInSky, sunPosition } from '../lib/sun';
import { skyFor } from '../lib/sky';
import { MoonBody, SunBody } from './Celestial';

/**
 * The background: the real sun, in the real place it is right now.
 *
 * Deliberately not WebGL. The whole scene is a handful of layered radial
 * gradients on composited elements, so it costs no library, no canvas and no
 * per-frame work — the position updates once every half minute and CSS
 * transitions carry it the rest of the way. The roundness comes from an
 * off-centre highlight and a rim light, which is what actually reads as
 * three-dimensional at this size.
 */
export function Sky({
  latitude,
  longitude,
  scene = true,
}: {
  latitude: number;
  longitude: number;
  /**
   * The sun, moon and stars belong to the prayer page. Elsewhere they are
   * scenery competing with a table or a settings list, so only the graded sky
   * is kept. This component stays mounted either way, because it is what keeps
   * the palette tracking the real sun — unmounting it would freeze the colours
   * on whatever page you happened to open first.
   */
  scene?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  // The arc is only animated after the first paint, so the sun does not visibly
  // slide in from a default position when the page opens.
  const [tracking, setTracking] = useState(false);
  const parallax = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /*
     * ?sky=<ISO time> freezes the background at a chosen moment. It moves only
     * the sun, moon and colours — prayer times keep their own clock — so it is
     * a safe way to look at dawn or midnight without waiting for them.
     */
    const override = new URLSearchParams(window.location.search).get('sky');
    if (override) {
      const at = new Date(override);
      if (!Number.isNaN(at.getTime())) {
        setNow(at);
        return;
      }
    }
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  /*
   * The sky drifts up as you scroll, at a third of the content's speed. Pinned
   * absolutely still it reads as a sticker behind glass — the moon in
   * particular looked nailed to the screen. A third is enough to feel like
   * depth without the sun wandering off before you reach the board.
   */
  useEffect(() => {
    const layer = parallax.current;
    if (!layer) return;
    // Written straight from the scroll handler rather than through
    // requestAnimationFrame: setting a transform reads no layout, so it is
    // cheap, and rAF simply stops firing while the tab is in the background,
    // which left the sky stuck partway up the page on return.
    const onScroll = () => {
      layer.style.transform = `translate3d(0, ${-window.scrollY * 0.33}px, 0)`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const { paint, place, horizonHeat } = useMemo(() => {
    const position = sunPosition(now, latitude, longitude);
    return {
      paint: skyFor(position.altitude),
      place: placeInSky(position),
      horizonHeat: Math.max(0, 1 - Math.abs(position.altitude) / 10),
    };
  }, [now, latitude, longitude]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--sky-top', paint.top);
    root.style.setProperty('--sky-bottom', paint.bottom);
    root.style.setProperty('--glow', paint.glow);
    root.style.setProperty('--sun-core', paint.sunCore);
    root.style.setProperty('--sun-halo', paint.sunHalo);
    root.style.setProperty('--sun-x', `${place.x}%`);
    root.style.setProperty('--sun-y', `${place.y}%`);
    root.style.setProperty('--star-opacity', String(paint.starOpacity));
    root.style.setProperty('--sun-opacity', String(paint.sunOpacity));
    root.style.setProperty('--horizon-heat', String(horizonHeat));
    root.dataset.ui = paint.lightUi ? 'light' : 'dark';
    const frame = requestAnimationFrame(() => setTracking(true));
    return () => cancelAnimationFrame(frame);
  }, [paint, place, horizonHeat]);

  const stars = useMemo(() => {
    let seed = 20260829;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    return Array.from({ length: 60 }, () => ({
      x: random() * 100,
      y: random() * 60,
      size: 1 + random() * 1.5,
      delay: random() * 6,
      duration: 3 + random() * 4,
    }));
  }, []);

  return (
    // Fixed, not absolute: the vertical mapping is against the screen, so the
    // horizon stays where the horizon is instead of scrolling off with content.
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div ref={parallax} className="sky-parallax">
      {scene && (
      <>
      <div className="star-field absolute inset-0">
        {stars.map((star, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-[#dce6ff]"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animation: `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Heat haze that only shows up when the sun is close to the horizon. */}
      <div className="horizon-haze" />

      <div className={`sun-stage${tracking ? ' is-tracking' : ''}`}>
        <div className="sun-atmosphere" />
        <div className="sun-corona" />
        <div className="sun-disc">
          <SunBody />
        </div>
      </div>

      {paint.moonlit > 0.02 && (
        <div className="moon" style={{ opacity: paint.moonlit }}>
          <div className="moon-disc">
            <MoonBody date={now} />
          </div>
        </div>
      )}
      </>
      )}
      </div>

      <div className="content-scrim" />
    </div>
  );
}
