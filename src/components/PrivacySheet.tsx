import { useState } from 'react';
import { Sheet } from './Sheet';
import { POLICY_VERSION, forgetMe, visitorId } from '../lib/analytics';
import { useI18n } from '../lib/i18n';

export function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [erased, setErased] = useState(false);
  const { text } = useI18n();

  const erase = async () => {
    await forgetMe();
    setErased(true);
  };

  return (
    <Sheet open={open} title={text('Privacy', 'الخصوصية')} subtitle={`${text('Version', 'الإصدار')} ${POLICY_VERSION}`} onClose={onClose}>
      <div className="space-y-5 text-sm leading-relaxed text-[var(--ink-dim)]">
        <p className="text-[var(--ink)]">
          {text('Prayer times are worked out on your own device. Your location is needed for that, and for that purpose it never leaves your phone.', 'تُحسب مواقيت الصلاة على جهازك. يحتاج الحساب إلى موقعك، ولهذا الغرض لا يغادر موقعك هاتفك.')}
        </p>

        <Section title={text('What is recorded every visit', 'ما يُسجَّل في كل زيارة')}>
          <p>
            {text('A random identifier created in your browser, how many times you have opened the app, the town and country the app resolved, your time zone, device type, browser language, and which calculation method you use. The identifier is not linked to your name, email, phone number or account, because the app has none of those.', 'معرّف عشوائي يُنشأ في متصفحك، وعدد مرات فتح التطبيق، والمدينة والدولة اللتان حددهما، ومنطقتك الزمنية، ونوع الجهاز، ولغة المتصفح، وطريقة الحساب المستخدمة. لا يرتبط المعرّف باسمك أو بريدك الإلكتروني أو رقم هاتفك أو حساب، لأن التطبيق لا يجمع أيًا منها.')}
          </p>
        </Section>

        <Section title={text('What is recorded only if you allow it', 'ما يُسجَّل فقط بإذنك')}>
          <p className="text-[var(--ink)]">
            {text('Your exact coordinates, with the time they were taken, each time you open the app.', 'إحداثياتك الدقيقة مع وقت التقاطها في كل مرة تفتح فيها التطبيق.')}
          </p>
          <p className="mt-2">
            {text("This is off unless you switch it on. If you switch it on, the person who runs this app can see where you are, to roughly the accuracy your phone's GPS gives, and can see that position update as you use the app on different days. It is not shared with advertisers or sold, and there are no third-party trackers anywhere in this app — but be clear that it is a real record of your whereabouts, held by someone else.", 'يظل هذا الخيار متوقفًا ما لم تفعّله. عند تفعيله يستطيع مشغّل التطبيق رؤية موقعك بدقة تقارب دقة GPS في هاتفك، ومشاهدة تغيره عند استخدام التطبيق في أيام مختلفة. لا تُباع هذه البيانات ولا تُشارك مع المعلنين، ولا توجد أدوات تتبع خارجية في التطبيق؛ لكنها تظل سجلًا حقيقيًا لمكانك محفوظًا لدى شخص آخر.')}
          </p>
        </Section>

        <Section title={text('Why any of it is recorded', 'سبب تسجيل هذه البيانات')}>
          <p>
            {text('So the person who built this can see how many people use it and where, and keep the prayer times correct for those places. Nothing here is used for advertising.', 'حتى يعرف مطوّر التطبيق عدد المستخدمين وأماكن استخدامه، ويحافظ على دقة المواقيت فيها. لا تُستخدم أي من هذه البيانات للإعلانات.')}
          </p>
        </Section>

        <Section title={text('Where it is kept', 'مكان حفظ البيانات')}>
          <p>
            {text("In a hosted Postgres database on Supabase. The app can only write to it, never read from it, so no user of this app can see another user's data.", 'في قاعدة بيانات Postgres مستضافة على Supabase. يستطيع التطبيق الكتابة إليها فقط ولا يستطيع قراءة محتواها، لذلك لا يمكن لأي مستخدم رؤية بيانات مستخدم آخر.')}
          </p>
        </Section>

        <Section title={text('Turning it off, and deleting it', 'إيقاف المشاركة وحذف البيانات')}>
          <p>
            {text('The precise-location switch is under Settings → Privacy, and turning it off stops new positions being recorded immediately. The button below permanently deletes every record tied to this browser, positions included, and starts you over as a new anonymous visitor.', 'يوجد مفتاح الموقع الدقيق ضمن الإعدادات ← الخصوصية، ويوقف تعطيله تسجيل المواقع الجديدة فورًا. يحذف الزر أدناه نهائيًا كل سجل مرتبط بهذا المتصفح، بما في ذلك المواقع، ثم يبدأ معرّفًا مجهولًا جديدًا.')}
          </p>
        </Section>

        <button
          onClick={erase}
          disabled={erased}
          className="w-full rounded-2xl border border-[var(--card-line)] px-5 py-3 text-sm font-medium text-[var(--ink)] transition active:bg-white/10 disabled:opacity-60"
        >
          {erased ? text('Deleted', 'تم الحذف') : text('Delete everything recorded about me', 'حذف كل البيانات المسجلة عني')}
        </button>

        <p className="text-xs text-[var(--ink-faint)]">
          {text('Your current anonymous id is', 'معرّفك المجهول الحالي هو')}{' '}
          <span className="tabular break-all">{visitorId()}</span>.
        </p>
      </div>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-[var(--ink)]">{title}</h3>
      <div className="mt-1">{children}</div>
    </div>
  );
}
