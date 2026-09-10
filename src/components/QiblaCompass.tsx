import { useEffect, useMemo, useRef, useState } from 'react';
import geomagnetism from 'geomagnetism';
import { distanceMeters, qiblaIssue, type QiblaFix, type QiblaIssue } from '../lib/qiblaQuality';
import { qiblaDegrees } from '../lib/prayer';
import { lerpAngle, normaliseSigned, screenAngle, readingFrom, relativeTurn, solarCalibration, type Reading } from '../lib/heading';
import { sunPosition } from '../lib/sun';
import { useStore } from '../lib/store';
import { haptic, hapticsAvailable } from '../lib/feel';
import { useI18n } from '../lib/i18n';

type PermissionCapableCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

type Status = 'idle' | 'live' | 'denied' | 'unsupported';

const CARDINALS = [
  { label: 'N', labelAr: 'ش', angle: 0 },
  { label: 'E', labelAr: 'ق', angle: 90 },
  { label: 'S', labelAr: 'ج', angle: 180 },
  { label: 'W', labelAr: 'غ', angle: 270 },
];

/**
 * The Qibla, at the size it deserves.
 *
 * The bearing is exact — a great-circle heading to the Kaaba, checked against an
 * independent implementation. Everything uncertain is the phone's magnetometer,
 * so the dial shows what it is actually working from: the needle fades when the
 * reading is unsteady, and the sun line, which needs no compass at all, is
 * always offered alongside it.
 */
export function QiblaCompass({ bearing: savedBearing }: { bearing: number }) {
  const [fix, setFix] = useState<QiblaFix | null>(null);
  const watch = useRef<number | null>(null);
  const absoluteAt = useRef(-Infinity);
  const stableSince = useRef(0);
  const [issue, setIssue] = useState<QiblaIssue | null>('location');
  const issueRef = useRef<QiblaIssue | null>('location');
  const [locationMessage, setLocationMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const place = useStore((state) => state.place);
  // Calibration applies only to this session and location, never to a later trip.
  const [qiblaOffset, setQiblaOffset] = useState<number | null>(null);
  const calibrationAt = useRef<{ latitude: number; longitude: number } | null>(null);
  const { isArabic, text } = useI18n();
  const bearing = fix ? qiblaDegrees(fix.latitude, fix.longitude) : savedBearing;
  const latitude = fix?.latitude ?? place?.latitude;
  const longitude = fix?.longitude ?? place?.longitude;
  const declination = useMemo(() => {
    if (latitude == null || longitude == null) return null;
    try { return geomagnetism.model(new Date()).point([latitude, longitude, 0]).decl; }
    catch { return null; }
  }, [latitude, longitude]);

  const [reading, setReading] = useState<Reading | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [now, setNow] = useState(() => new Date());
  const [aligned, setAligned] = useState(false);
  const listening = useRef(false);
  const raw = useRef<Reading | null>(null);
  const receivedAt = useRef(0);
  const shown = useRef(0);
  const rose = useRef<SVGGElement>(null);
  const needle = useRef<SVGGElement>(null);
  const lastFrame = useRef(0);
  const lastUi = useRef(0);
  const lastStep = useRef<number | null>(null);
  const wasAligned = useRef(false);
  const primed = useRef(false);
  const ios =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); }, []);

  useEffect(() => {
    if (status !== 'live' || listening.current) return;
    listening.current = true;
    const onOrientation = (event: Event) => {
      const orientation = event as DeviceOrientationEvent;
      const apple = 'webkitCompassHeading' in orientation;
      const absolute = orientation.absolute === true || event.type === 'deviceorientationabsolute';
      if (!apple && !absolute && performance.now() - absoluteAt.current < 2000) return;
      if (absolute) absoluteAt.current = performance.now();
      const next = readingFrom(event as DeviceOrientationEvent);
      raw.current = next;
      receivedAt.current = performance.now();
    };
    // iOS puts webkitCompassHeading on deviceorientation; absolute is extra on Android.
    window.addEventListener('deviceorientation', onOrientation, true);
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', onOrientation, true);
    }
    return () => {
      window.removeEventListener('deviceorientation', onOrientation, true);
      window.removeEventListener('deviceorientationabsolute', onOrientation, true);
      listening.current = false;
    };
  }, [status]);

  useEffect(() => {
    if (status !== 'live') return;
    let raf = 0;
    const tick = (time: number) => {
      raf = requestAnimationFrame(tick);
      const sample = raw.current;
      const correction = qiblaOffset ?? (sample?.reference === 'true' ? 0 : declination);
      const problem = qiblaIssue(
        fix,
        sample,
        time - receivedAt.current,
        screenAngle(),
        correction,
        qiblaOffset !== null,
      );
      if (issueRef.current !== problem) {
        issueRef.current = problem;
        setIssue(problem);
      }
      if (problem || !sample || document.visibilityState !== 'visible') {
        if (needle.current) needle.current.style.visibility = 'hidden';
        if (rose.current) rose.current.setAttribute('transform', 'rotate(0 200 200)');
        primed.current = false;
        stableSince.current = 0;
        wasAligned.current = false;
        setAligned(false);
        if (time - lastUi.current > 180) {
          lastUi.current = time;
          setReading(sample);
        }
        return;
      }

      const dt = lastFrame.current ? Math.min(0.05, (time - lastFrame.current) / 1000) : 0.016;
      lastFrame.current = time;
      const corrected = (sample.degrees + correction! + 360) % 360;
      if (!primed.current) {
        shown.current = corrected;
        primed.current = true;
        setReading(sample);
      }
      const tau = ios ? 0.1 : 0.055;
      const k = 1 - Math.exp(-dt / tau);
      shown.current = lerpAngle(shown.current, corrected, k);

      if (rose.current) rose.current.setAttribute('transform', `rotate(${-shown.current} 200 200)`);
      if (needle.current) {
        needle.current.style.visibility = 'visible';
        needle.current.setAttribute('transform', `rotate(${bearing - shown.current} 200 200)`);
      }

      const rotation = bearing - shown.current;
      const off = Math.abs(((rotation % 360) + 360) % 360);
      const candidate = (off < 4 || off > 356) && Math.abs(normaliseSigned(corrected - shown.current)) < 2 && sample.accuracy !== null && sample.accuracy <= 5;
      if (!candidate) stableSince.current = 0;
      else if (!stableSince.current) stableSince.current = time;
      const on = candidate && time - stableSince.current > 1000;

      if (on && !wasAligned.current) haptic('lock');
      wasAligned.current = on;
      if (!on) {
        const away = Math.min(off, 360 - off);
        if (away < 40) {
          const step = Math.round(away / 5);
          if (lastStep.current !== null && step !== lastStep.current) haptic('tick');
          lastStep.current = step;
        } else {
          lastStep.current = null;
        }
      }

      if (time - lastUi.current > 180) {
        lastUi.current = time;
        setAligned(on);
        setReading((prev) => {
          if (
            prev &&
            prev.reference === sample.reference &&
            Math.abs(prev.level - sample.level) < 0.05 &&
            prev.accuracy === sample.accuracy
          ) {
            return prev;
          }
          return sample;
        });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, bearing, qiblaOffset, ios, declination, fix]);

  const enable = async () => {
    setLocating(true);
    setLocationMessage('');
    setFix(null);
    issueRef.current = 'location';
    setIssue('location');
    setQiblaOffset(null);
    calibrationAt.current = null;
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    if (navigator.geolocation) watch.current = navigator.geolocation.watchPosition(({ coords, timestamp }) => {
      if (
        calibrationAt.current &&
        distanceMeters(
          calibrationAt.current.latitude,
          calibrationAt.current.longitude,
          coords.latitude,
          coords.longitude,
        ) > 100
      ) {
        calibrationAt.current = null;
        setQiblaOffset(null);
      }
      setFix({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, timestamp });
      setLocating(false);
      setLocationMessage(text(`GPS accuracy: ±${Math.round(coords.accuracy)} m`, `دقة الموقع: ±${Math.round(coords.accuracy)} م`));
    }, () => {
      setFix(null);
      setLocating(false);
      setLocationMessage(text('Location unavailable. Allow precise location in your browser settings and retry. The live arrow is disabled.', 'الموقع غير متاح. اسمح بالموقع الدقيق في إعدادات المتصفح وأعد المحاولة. تم إيقاف السهم المباشر.'));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    else { setLocating(false); setLocationMessage(text('Location is not supported in this browser.', 'هذا المتصفح لا يدعم تحديد الموقع.')); }
    if (typeof DeviceOrientationEvent === 'undefined') return setStatus('unsupported');
    const ctor = DeviceOrientationEvent as PermissionCapableCtor;
    try {
      if (typeof ctor.requestPermission === 'function') {
        if ((await ctor.requestPermission()) !== 'granted') return setStatus('denied');
      }
      primed.current = false;
      raw.current = null;
      setReading(null);
      lastFrame.current = 0;
      setStatus('live');
    } catch {
      setStatus('denied');
    }
  };

  const sun = latitude != null && longitude != null ? sunPosition(now, latitude, longitude) : null;
  const sunUp = sun !== null && sun.altitude > 1;
  const fromSun = sun ? relativeTurn(sun.azimuth, bearing) : null;

  const live = issue === null && status === 'live' && reading !== null;
  const shaky = reading !== null && (reading.level < 0.45 || (reading.accuracy ?? 0) < 0 || (reading.accuracy ?? 0) > 20);
  const canSolarCalibrate = Boolean(
    status === 'live' &&
      fix &&
      raw.current &&
      sunUp &&
      qiblaIssue(
        fix,
        raw.current,
        performance.now() - receivedAt.current,
        screenAngle(),
        0,
        true,
      ) === null,
  );

  const calibrate = () => {
    if (raw.current && sun && canSolarCalibrate && !shaky && fix) {
      calibrationAt.current = { latitude: fix.latitude, longitude: fix.longitude };
      setQiblaOffset(solarCalibration(sun.azimuth, raw.current.degrees));
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button type="button" disabled={locating} onClick={() => void enable()} className="mb-3 rounded-full border border-[var(--card-line)] px-4 py-2 text-sm">
        {locating ? text('Finding your location…', 'جارٍ تحديد موقعك…') : text('Use current location & compass', 'استخدام الموقع الحالي والبوصلة')}
      </button>
      {locationMessage && <p className="mb-3 max-w-sm text-center text-xs text-[var(--ink-dim)]">{locationMessage}</p>}
      {status !== 'denied' && status !== 'unsupported' && (
      <p className="mb-3 max-w-sm text-center text-sm" role="status">
        {issue ? text(
          ({ location: 'Enable precise location to use the live arrow.', 'location-stale': 'Location is stale. Refresh your location.', 'location-poor': 'Location is too imprecise. Move outdoors and retry.', 'near-kaaba': 'Too close to the Kaaba for a reliable phone bearing. Use the visible Kaaba or mosque alignment.', portrait: 'Hold the phone in portrait orientation.', waiting: 'Waiting for a compass reading.', stale: 'Compass data stopped. The arrow is hidden.', relative: 'This browser is not providing a compass heading.', flat: 'Hold the screen face up and nearly flat.', 'sensor-unverified': 'This browser does not report compass accuracy. Calibrate with the sun and a shadow to enable the arrow.', 'sensor-poor': 'Compass accuracy is poor. Remove magnetic accessories and recalibrate.', model: 'Magnetic correction unavailable. Calibrate with the sun and a shadow to enable the arrow.' } as const)[issue],
          ({ location: 'فعّل الموقع الدقيق لاستخدام السهم المباشر.', 'location-stale': 'الموقع قديم. حدّث موقعك.', 'location-poor': 'الموقع غير دقيق. انتقل إلى مكان مفتوح وأعد المحاولة.', 'near-kaaba': 'أنت قريب جدًا من الكعبة لاتجاه موثوق بالهاتف. اعتمد الكعبة المرئية أو اتجاه المسجد.', portrait: 'استخدم وضع الشاشة العمودي.', waiting: 'بانتظار قراءة البوصلة.', stale: 'توقفت بيانات البوصلة. تم إخفاء السهم.', relative: 'المتصفح لا يوفر اتجاه بوصلة.', flat: 'اجعل الشاشة لأعلى والهاتف شبه أفقي.', 'sensor-unverified': 'المتصفح لا يبلّغ عن دقة البوصلة. عاير باستخدام الشمس والظل لتفعيل السهم.', 'sensor-poor': 'دقة البوصلة ضعيفة. أزل الملحقات المغناطيسية وأعد المعايرة.', model: 'تصحيح الشمال غير متاح. عاير باستخدام الشمس والظل لتفعيل السهم.' } as const)[issue])
          : text('Estimated phone direction — confirm against a trusted mosque alignment.', 'اتجاه تقديري للهاتف — قارنه باتجاه مسجد موثوق.')}
      </p>
      )}
      <div className={`qibla-stage${aligned ? ' is-aligned' : ''}`}>
        <svg viewBox="0 0 400 400" className="qibla-face" aria-label={text(`Qibla ${bearing.toFixed(1)} degrees from true north`, `اتجاه القبلة ${bearing.toFixed(1)} درجة من الشمال الحقيقي`)}>
          <defs>
            <radialGradient id="q-well" cx="42%" cy="34%" r="72%">
              <stop offset="0%" stopColor="var(--card)" stopOpacity="0.9" />
              <stop offset="70%" stopColor="var(--card)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--card)" stopOpacity="0.05" />
            </radialGradient>
            <linearGradient id="q-needle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-soft)" />
            </linearGradient>
            <radialGradient id="q-halo" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="var(--accent)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.16" />
            </radialGradient>
          </defs>

          <circle cx="200" cy="200" r="186" fill="url(#q-halo)" />
          <circle cx="200" cy="200" r="168" fill="url(#q-well)" stroke="var(--card-line)" strokeWidth="1" />
          <circle cx="200" cy="200" r="150" fill="none" stroke="var(--card-line)" strokeWidth="1" opacity="0.6" />

          {/* The rose turns with the phone; the Qibla marker rides on it. */}
          <g
            ref={rose}
            className="qibla-spin"
            transform="rotate(0 200 200)"
          >
            {Array.from({ length: 72 }, (_, i) => {
              const major = i % 9 === 0;
              const mid = i % 3 === 0;
              return (
                <line
                  key={i}
                  x1="200"
                  y1={major ? 24 : mid ? 28 : 30}
                  x2="200"
                  y2={major ? 44 : mid ? 38 : 35}
                  stroke={major ? 'var(--ink-dim)' : 'var(--ink-faint)'}
                  strokeWidth={major ? 2.4 : mid ? 1.4 : 1}
                  strokeLinecap="round"
                  opacity={major ? 0.95 : mid ? 0.6 : 0.35}
                  transform={`rotate(${i * 5} 200 200)`}
                />
              );
            })}

            {CARDINALS.map(({ label, labelAr, angle }) => (
              <g key={label} transform={`rotate(${angle} 200 200)`}>
                {/* Counter-rotated so the glyph itself is never on its side. */}
                <text
                  x="200"
                  y="68"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="18"
                  fontWeight="600"
                  fill={label === 'N' ? 'var(--accent)' : 'var(--ink-faint)'}
                  transform={`rotate(${-angle} 200 68)`}
                >
                  {isArabic ? labelAr : label}
                </text>
              </g>
            ))}

            {/* Kaaba marker, sitting at the true bearing on the rose. */}
            <g transform={`rotate(${bearing} 200 200)`}>
              <g transform={`translate(200 104) rotate(${-bearing})`}>
                <circle r="17" fill="var(--accent)" opacity="0.16" />
                <rect x="-9" y="-10" width="18" height="20" rx="2" fill="var(--accent)" />
                <rect x="-9" y="-3" width="18" height="3.4" fill="var(--on-accent)" opacity="0.65" />
                <rect x="-9" y="-10" width="18" height="2.2" fill="#ffffff" opacity="0.35" />
              </g>
            </g>
          </g>

          {/* The needle is fixed to the screen: it points where you must turn. */}
          <g
            ref={needle}
            className="qibla-spin"
            style={{ visibility: 'hidden' }}
          >
            <path d="M200 74 L212 196 L200 186 L188 196 Z" fill="url(#q-needle)" />
            <path d="M200 74 L206 136 L200 130 L194 136 Z" fill="#ffffff" opacity="0.32" />
          </g>

          <circle cx="200" cy="200" r="9" fill="var(--accent)" />
          <circle cx="200" cy="200" r="3.5" fill="var(--on-accent)" opacity="0.7" />
        </svg>

        <div className="qibla-readout">
          <p className="tabular qibla-degrees">{bearing.toFixed(1)}°</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            {live ? text('from true north', 'من الشمال الحقيقي') : text('North-up reference · not phone direction', 'مرجع شمالي · ليس اتجاه الهاتف')}
          </p>
        </div>
      </div>

      <div className="mt-6 w-full max-w-sm space-y-3 text-center">
        {fix && sunUp && fromSun && (
          <p className="text-sm leading-relaxed text-[var(--ink-dim)]">
            {text('Face the sun, then turn', 'واجه الشمس، ثم استدر')}{' '}
            <span className="font-semibold text-[var(--ink)]">
              {fromSun.degrees}° {text(`to your ${fromSun.side}`, fromSun.side === 'left' ? 'إلى يسارك' : 'إلى يمينك')}
            </span>
            {text('. Calculated from the sun. Never look directly at it.', '. محسوب من موقع الشمس. لا تنظر إليها مباشرة.')}
          </p>
        )}

        {live && !hapticsAvailable && (
          <p className="text-xs leading-relaxed text-[var(--ink-faint)]">
            {text('This browser exposes no haptic feedback. The dial still changes when alignment is stable.', 'هذا المتصفح لا يوفر اهتزازًا. ستظل الحلقة تتغير عند ثبات المحاذاة.')}
          </p>
        )}

        {live && !shaky && (
          <p className="text-sm text-[var(--ink-dim)]">
            {declination !== null && qiblaOffset === null
              ? text('Heading corrected to true north for your location.', 'تم تصحيح الاتجاه إلى الشمال الحقيقي بحسب موقعك.')
              : reading?.reference === 'true'
              ? text('Live, referenced to true north.', 'قراءة مباشرة نسبةً إلى الشمال الحقيقي.')
              : qiblaOffset !== null
                ? text('Live, corrected against the sun.', 'قراءة مباشرة مصححة باستخدام الشمس.')
                : text('Live, from magnetic north — a couple of degrees off in the UAE, more elsewhere.', 'قراءة مباشرة من الشمال المغناطيسي؛ قد تنحرف بضع درجات في الإمارات وأكثر في أماكن أخرى.')}
          </p>
        )}

        {canSolarCalibrate && (
          <button
            onClick={calibrate}
            className="w-full rounded-2xl border border-[var(--card-line)] px-5 py-3 text-sm font-medium transition active:bg-white/10"
          >
            {qiblaOffset === null
              ? text('Calibrate safely: use a shadow to align the phone’s top edge with the sun, then tap', 'للمعايرة بأمان: استخدم الظل لمحاذاة أعلى الهاتف مع اتجاه الشمس ثم اضغط')
              : text('Re-calibrate against the sun', 'إعادة المعايرة باستخدام الشمس')}
          </button>
        )}

        {qiblaOffset !== null && (
          <button
            onClick={() => {
              calibrationAt.current = null;
              setQiblaOffset(null);
            }}
            className="text-xs text-[var(--ink-dim)] underline underline-offset-4"
          >
            {text('Clear the', 'مسح تصحيح')} {qiblaOffset > 0 ? '+' : ''}
            {qiblaOffset.toFixed(1)}°
          </button>
        )}

        {status === 'denied' && (
          <p className="text-sm text-[var(--ink-dim)]">
            {text('Motion access was refused. The live arrow is disabled; the angle above is only a north-up reference.', 'تم رفض إذن الحركة. السهم المباشر متوقف؛ الزاوية أعلاه مرجع شمالي فقط.')}
          </p>
        )}
        {status === 'unsupported' && (
          <p className="text-sm text-[var(--ink-dim)]">
            {text('This browser exposes no usable compass. The live arrow is disabled.', 'هذا المتصفح لا يوفر بوصلة قابلة للاستخدام. السهم المباشر متوقف.')}
          </p>
        )}
      </div>
    </div>
  );
}
