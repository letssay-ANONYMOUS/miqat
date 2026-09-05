import { METHOD_BY_KEY } from '../lib/methods';
import { publishedCityFor } from '../lib/officialTimetable';
import { useStore } from '../lib/store';
import { useI18n } from '../lib/i18n';
import { localizedUaeName } from '../lib/uaePlaces';

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
  const { language, locale, text, methodLabel } = useI18n();
  const shownCity = publishedCity ? localizedUaeName(publishedCity, language) : null;
  const shownMethod = methodLabel(method.key, method.label);

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
          ? text(`Showing Awqaf's published timetable for ${publishedCity}`, `عرض جدول الأوقاف المنشور لمدينة ${shownCity}`)
          : verified
            ? text(`${method.label} is verified`, `تم التحقق من طريقة ${shownMethod}`)
            : text(`${method.label} is not yet verified`, `لم يتم التحقق من طريقة ${shownMethod} بعد`)}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--ink-dim)]">
        {publishedCity ? (
          <>
            {text("These are the authority's own times, carried in the app rather than calculated — so they match what your mosque calls exactly, including every seasonal adjustment Awqaf makes. Days they have not published yet fall back to the calculation, and the app says so when that happens. Every day shipped was checked against a second publisher before it went in.", 'هذه مواقيت الجهة الرسمية محفوظة داخل التطبيق وليست محسوبة، لذلك تطابق أذان مسجدك وتشمل تعديلات الأوقاف الموسمية. عند غياب يوم منشور يعود التطبيق إلى الحساب الفلكي ويوضح ذلك. تمت مطابقة كل يوم مضمّن مع ناشر ثانٍ قبل إضافته.')}
          </>
        ) : verified ? (
          <>
            {text(
              `Checked against ${verified.authority}: every one of ${verified.comparisons.toLocaleString()} published times matched within a minute, and it is re-checked every day.`,
              `تمت المقارنة مع ${verified.authority}: تطابقت المواقيت المنشورة البالغ عددها ${verified.comparisons.toLocaleString(locale)} كلها ضمن دقيقة واحدة، ويُعاد الفحص يوميًا.`,
            )}
          </>
        ) : (
          <>
            {text(
              `The astronomy is identical everywhere and the angles come from this convention's published parameters, so these times should be right. But nobody has yet compared them against a timetable published by the authority in ${method.region}, so this app will not claim they match what your mosque calls. If they differ, the manual correction under Settings → Fine tune will fix it exactly.`,
              `الحساب الفلكي واحد في كل مكان، والزوايا مأخوذة من المعايير المنشورة لهذه الطريقة، لذا يُفترض أن تكون المواقيت صحيحة. لكنها لم تُقارن بعد بجدول صادر عن الجهة الرسمية في ${method.region}، لذلك لا يدّعي التطبيق أنها تطابق أذان مسجدك. إذا اختلفت، استخدم التصحيح اليدوي ضمن الإعدادات ← الضبط.`,
            )}
          </>
        )}
      </p>
    </div>
  );
}
