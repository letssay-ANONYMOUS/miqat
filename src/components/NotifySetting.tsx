import { useState } from 'react';
import { selectClass } from './Sheet';
import { notifyPermission, requestNotifyPermission, type NotifyPermission } from '../lib/notify';
import { playChime, soundSupported } from '../lib/chime';
import { nowPlayingSupported, startNowPlaying, stopNowPlaying } from '../lib/nowPlaying';
import { useStore } from '../lib/store';

export function NotifySetting() {
  const { settings, patchSettings } = useStore();
  const [permission, setPermission] = useState<NotifyPermission>(() => notifyPermission());

  const toggleNotify = async (wanted: boolean) => {
    if (!wanted) {
      patchSettings({ notifyEnabled: false });
      return;
    }
    let state = permission;
    if (state === 'default') {
      state = await requestNotifyPermission();
      setPermission(state);
    }
    patchSettings({ notifyEnabled: state === 'granted' });
  };

  const toggleSound = (wanted: boolean) => {
    patchSettings({ soundEnabled: wanted });
    // Doubles as the gesture that unlocks audio for the rest of the session.
    if (wanted) playChime(settings.soundVolume);
  };

  const blocked = permission === 'denied' || permission === 'unsupported';

  const toggleLockScreen = async (wanted: boolean) => {
    if (!wanted) {
      stopNowPlaying();
      patchSettings({ lockScreenEnabled: false });
      return;
    }
    // Audio only starts from a gesture, so claim the session on this tap.
    const started = await startNowPlaying({
      prayer: 'Miqāt',
      at: '',
      remaining: 'prayer times',
      place: '',
    });
    patchSettings({ lockScreenEnabled: started });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--card-line)] p-4">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-[13px] font-medium">Notify me</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-faint)]">
              A banner at each prayer while this page is open. Waking a locked phone needs the app
              added to your home screen — that part is not built yet.
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.notifyEnabled}
            disabled={blocked}
            onChange={(e) => toggleNotify(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)] disabled:opacity-40"
          />
        </label>

        {settings.notifyEnabled && (
          <select
            className={selectClass}
            value={settings.notifyLead}
            onChange={(e) => patchSettings({ notifyLead: Number(e.target.value) })}
          >
            <option value={0}>At the time itself</option>
            <option value={5}>5 minutes before</option>
            <option value={10}>10 minutes before</option>
            <option value={15}>15 minutes before</option>
          </select>
        )}

        {permission === 'denied' && (
          <p className="mt-2 text-xs leading-relaxed text-[var(--ink-faint)]">
            Notifications are blocked for this site in your browser settings.
          </p>
        )}
        {permission === 'unsupported' && (
          <p className="mt-2 text-xs leading-relaxed text-[var(--ink-faint)]">
            This browser has no notification support.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--card-line)] p-4">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-[13px] font-medium">Show on the lock screen</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-faint)]">
              Puts the next prayer in the Dynamic Island and on the lock screen, where the
              now-playing controls live. It works by holding the audio session, so it will stop
              your music and it drains a little battery — turn it off when you don't want it.
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.lockScreenEnabled}
            disabled={!nowPlayingSupported}
            onChange={(e) => toggleLockScreen(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)] disabled:opacity-40"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-[var(--card-line)] p-4">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-[13px] font-medium">Play a chime</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-faint)]">
              A soft bell at each prayer. It is a tone the app makes itself, not a recorded adhan —
              every recording of one belongs to the person who called it.
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            disabled={!soundSupported}
            onChange={(e) => toggleSound(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)] disabled:opacity-40"
          />
        </label>

        {settings.soundEnabled && (
          <>
            <div className="mt-4 flex items-center gap-3">
              <span className="w-16 text-sm">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.soundVolume * 100)}
                onChange={(e) => patchSettings({ soundVolume: Number(e.target.value) / 100 })}
                className="flex-1"
              />
              <span className="tabular w-12 text-right text-sm text-[var(--ink-dim)]">
                {Math.round(settings.soundVolume * 100)}%
              </span>
            </div>
            <button
              onClick={() => playChime(settings.soundVolume)}
              className="mt-3 w-full rounded-xl border border-[var(--card-line)] px-4 py-2.5 text-sm font-medium transition active:bg-white/10"
            >
              Test the chime
            </button>
          </>
        )}
      </div>
    </div>
  );
}
