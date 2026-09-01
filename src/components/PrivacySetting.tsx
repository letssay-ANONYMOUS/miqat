import { useState } from 'react';
import { PrivacySheet } from './PrivacySheet';
import { syncConsent } from '../lib/analytics';
import { useStore } from '../lib/store';

export function PrivacySetting() {
  const { place, settings, sharePreciseLocation, setSharePreciseLocation } = useStore();
  const [policyOpen, setPolicyOpen] = useState(false);

  const toggle = (share: boolean) => {
    setSharePreciseLocation(share);
    if (place) void syncConsent(place, settings.method, share);
  };

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-[var(--ink-faint)]">
        Prayer times are worked out on this device and your location is not needed anywhere else
        for them to be correct.
      </p>

      <div className="rounded-2xl border border-[var(--card-line)] p-4">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-[13px] font-medium">Share my exact location</span>
            <span className="mt-1 block text-xs leading-relaxed text-[var(--ink-faint)]">
              Sends your precise coordinates, and the time they were taken, to the person who runs
              this app each time you open it. They will be able to see where you are and watch that
              update over time. Off unless you turn it on.
            </span>
          </span>
          <input
            type="checkbox"
            checked={sharePreciseLocation}
            onChange={(e) => toggle(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
          />
        </label>
      </div>

      <p className="text-xs leading-relaxed text-[var(--ink-faint)]">
        With it off, the app still records an anonymous id, a visit count and the town it resolved
        for you — ordinary usage figures, with no name attached. The full detail, and a button to
        delete everything held about you, is in the policy.
      </p>

      <button
        onClick={() => setPolicyOpen(true)}
        className="w-full rounded-2xl border border-[var(--card-line)] px-5 py-3 text-sm font-medium transition active:bg-white/10"
      >
        Read the privacy policy
      </button>

      <PrivacySheet open={policyOpen} onClose={() => setPolicyOpen(false)} />
    </div>
  );
}
