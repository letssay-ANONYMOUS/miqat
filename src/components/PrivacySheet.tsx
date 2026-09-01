import { useState } from 'react';
import { Sheet } from './Sheet';
import { POLICY_VERSION, forgetMe, visitorId } from '../lib/analytics';

export function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [erased, setErased] = useState(false);

  const erase = async () => {
    await forgetMe();
    setErased(true);
  };

  return (
    <Sheet open={open} title="Privacy" subtitle={`Version ${POLICY_VERSION}`} onClose={onClose}>
      <div className="space-y-5 text-sm leading-relaxed text-[var(--ink-dim)]">
        <p className="text-[var(--ink)]">
          Prayer times are worked out on your own device. Your location is needed for that, and for
          that purpose it never leaves your phone.
        </p>

        <Section title="What is recorded every visit">
          <p>
            A random identifier created in your browser, how many times you have opened the app, the
            town and country the app resolved, your time zone, device type, browser language, and
            which calculation method you use. The identifier is not linked to your name, email,
            phone number or account, because the app has none of those.
          </p>
        </Section>

        <Section title="What is recorded only if you allow it">
          <p className="text-[var(--ink)]">
            Your exact coordinates, with the time they were taken, each time you open the app.
          </p>
          <p className="mt-2">
            This is off unless you switch it on. If you switch it on, the person who runs this app
            can see where you are, to roughly the accuracy your phone's GPS gives, and can see that
            position update as you use the app on different days. It is not shared with advertisers
            or sold, and there are no third-party trackers anywhere in this app — but be clear that
            it is a real record of your whereabouts, held by someone else.
          </p>
        </Section>

        <Section title="Why any of it is recorded">
          <p>
            So the person who built this can see how many people use it and where, and keep the
            prayer times correct for those places. Nothing here is used for advertising.
          </p>
        </Section>

        <Section title="Where it is kept">
          <p>
            In a hosted Postgres database on Supabase. The app can only write to it, never read from
            it, so no user of this app can see another user's data.
          </p>
        </Section>

        <Section title="Turning it off, and deleting it">
          <p>
            The precise-location switch is under Settings → Privacy, and turning it off stops new
            positions being recorded immediately. The button below permanently deletes every record
            tied to this browser, positions included, and starts you over as a new anonymous
            visitor.
          </p>
        </Section>

        <button
          onClick={erase}
          disabled={erased}
          className="w-full rounded-2xl border border-[var(--card-line)] px-5 py-3 text-sm font-medium text-[var(--ink)] transition active:bg-white/10 disabled:opacity-60"
        >
          {erased ? 'Deleted' : 'Delete everything recorded about me'}
        </button>

        <p className="text-xs text-[var(--ink-faint)]">
          Your current anonymous id is{' '}
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
