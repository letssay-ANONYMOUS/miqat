import { METHOD_BY_KEY } from '../lib/methods';
import { publishedCityFor } from '../lib/officialTimetable';
import { useStore } from '../lib/store';

/**
 * Says plainly whether this convention has been proved against its own
 * authority. Only the UAE has been, and claiming otherwise for everyone else
 * would be the app asserting something nobody has checked.
 */
export function VerificationNote() {
  const settings = useStore((state) => state.settings);
  const place = useStore((state) => state.place);
  const method = METHOD_BY_KEY.get(settings.method)!;
  const verified = method.verifiedAgainst;
  const publishedCity = place ? publishedCityFor(place.latitude, place.longitude) : null;

  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 ${
        publishedCity || verified
          ? 'border-emerald-400/30 bg-emerald-400/10'
          : 'border-[var(--card-line)] bg-white/5'
      }`}
    >
      <p className="text-sm font-medium">
        {publishedCity
          ? `Showing Awqaf's published timetable for ${publishedCity}`
          : verified
            ? `${method.label} is verified`
            : `${method.label} is not yet verified`}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--ink-dim)]">
        {publishedCity ? (
          <>
            These are the authority's own times, carried in the app rather than calculated — so
            they match what your mosque calls exactly, including every seasonal adjustment Awqaf
            makes. Days they have not published yet fall back to the calculation, and the app says
            so when that happens. Every day shipped was checked against a second publisher before
            it went in.
          </>
        ) : verified ? (
          <>
            Checked against {verified.authority}: every one of{' '}
            {verified.comparisons.toLocaleString()} published times matched within a minute, and it
            is re-checked every day.
          </>
        ) : (
          <>
            The astronomy is identical everywhere and the angles come from this convention's
            published parameters, so these times should be right. But nobody has yet compared them
            against a timetable published by the authority in {method.region}, so this app will
            not claim they match what your mosque calls. If they differ, the manual correction
            under Settings → Fine tune will fix it exactly.
          </>
        )}
      </p>
    </div>
  );
}
