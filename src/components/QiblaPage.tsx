import { QiblaCompass } from './QiblaCompass';
import { useI18n } from '../lib/i18n';

export default function QiblaPage({ bearing }: { bearing: number }) {
  const { text } = useI18n();
  return (
    <section className="flex flex-1 flex-col items-center gap-5 py-6">
      <QiblaCompass bearing={bearing} />
      <div className="card w-full rounded-3xl px-5 py-4 text-xs leading-relaxed text-[var(--ink-dim)]">
        <p className="mb-2 text-[13px] font-medium text-[var(--ink)]">
          {text('Getting it right', 'للحصول على اتجاه دقيق')}
        </p>
        <p>
          {text(
            'Lay the phone flat, like a compass — held upright the sensor cannot tell which way you are facing. Keep it away from anything metal, and if the needle wanders, move the phone in a figure of eight to recalibrate it.',
            'ضع الهاتف أفقيًا مثل البوصلة، لأن المستشعر لا يستطيع تحديد اتجاهك عندما يكون الهاتف عموديًا. أبعده عن المعادن، وإذا تحركت الإبرة بشكل غير ثابت فحرّك الهاتف على شكل رقم 8 لإعادة المعايرة.',
          )}
        </p>
        <p className="mt-2">
          {text(
            'The daylight reference is calculated from your location and the sun. Check the direction using shadows; never look directly at the sun.',
            'مرجع النهار محسوب من موقعك والشمس. تحقّق باستخدام الظلال ولا تنظر إلى الشمس مباشرة.',
          )}
        </p>
      </div>
    </section>
  );
}
