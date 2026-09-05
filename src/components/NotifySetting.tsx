import { useState } from 'react';
import { selectClass } from './Sheet';
import { notifyPermission, requestNotifyPermission, type NotifyPermission } from '../lib/notify';
import { playChime, soundSupported } from '../lib/chime';
import { nowPlayingSupported, startNowPlaying, stopNowPlaying } from '../lib/nowPlaying';
import { useStore } from '../lib/store';
import { useI18n } from '../lib/i18n';
import { Segmented } from './Segmented';

export function NotifySetting() {
  const { settings, patchSettings } = useStore();
  const { text } = useI18n();
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
      remaining: text('prayer times', 'مواقيت الصلاة'),
      place: '',
    });
    patchSettings({ lockScreenEnabled: started });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--card-line)] p-4">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-[13px] font-medium">{text('Notify me', 'إشعارات الصلاة')}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-faint)]">
              {text(
                'A banner at each prayer while this page is open. Waking a locked phone needs the app added to your home screen — that part is not built yet.',
                'يظهر إشعار عند كل صلاة ما دامت الصفحة مفتوحة. تنبيه الهاتف المقفل يتطلب إضافة التطبيق إلى الشاشة الرئيسية، وهذه الميزة لم تُبنَ بعد.',
              )}
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
            <option value={0}>{text('At the time itself', 'عند دخول الوقت')}</option>
            <option value={5}>{text('5 minutes before', 'قبل 5 دقائق')}</option>
            <option value={10}>{text('10 minutes before', 'قبل 10 دقائق')}</option>
            <option value={15}>{text('15 minutes before', 'قبل 15 دقيقة')}</option>
          </select>
        )}

        {permission === 'denied' && (
          <p className="mt-2 text-xs leading-relaxed text-[var(--ink-faint)]">
            {text('Notifications are blocked for this site in your browser settings.', 'الإشعارات محظورة لهذا الموقع في إعدادات المتصفح.')}
          </p>
        )}
        {permission === 'unsupported' && (
          <p className="mt-2 text-xs leading-relaxed text-[var(--ink-faint)]">
            {text('This browser has no notification support.', 'هذا المتصفح لا يدعم الإشعارات.')}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--card-line)] p-4">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-[13px] font-medium">{text('Show on the lock screen', 'العرض على شاشة القفل')}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-faint)]">
              {text(
                'Shows a live countdown in the iPhone Dynamic Island, on the lock screen, and on Samsung’s Now Bar (the lock-screen media card). It holds the audio session, so it will pause your music.',
                'يعرض عدًّا تنازليًا في الجزيرة الديناميكية على iPhone، وعلى شاشة القفل، وعلى شريط Now في هواتف Samsung. يحتفظ بجلسة الصوت لذلك سيوقف الموسيقى.',
              )}
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
        {settings.lockScreenEnabled && (
          <div className="mt-3">
            <p className="mb-2 text-[12px] font-medium">{text('Countdown to show', 'العدّ المعروض')}</p>
            <Segmented
              label={text('Dynamic Island countdown', 'عدّ الجزيرة الديناميكية')}
              value={settings.lockScreenMode}
              onChange={(mode) => patchSettings({ lockScreenMode: mode })}
              options={[
                { value: 'adhan', label: text('Adhan', 'الأذان') },
                { value: 'iqama', label: text('Iqama', 'الإقامة') },
              ]}
            />
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink-faint)]">
              {text(
                'Adhan is the call. Iqama is the congregation. Pick which one the Island / Now Bar counts down to.',
                'الأذان هو النداء، والإقامة هي الجماعة. اختر أيهما يُعدّ على الجزيرة أو شريط Now.',
              )}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--card-line)] p-4">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-[13px] font-medium">{text('Play a chime', 'تشغيل نغمة تنبيه')}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-faint)]">
              {text(
                'A soft bell at each prayer. It is a tone the app makes itself, not a recorded adhan — every recording of one belongs to the person who called it.',
                'نغمة هادئة عند كل صلاة. يصنعها التطبيق بنفسه وليست تسجيلًا للأذان، لأن كل تسجيل أذان يعود لصاحبه.',
              )}
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
              <span className="w-16 text-sm">{text('Volume', 'الصوت')}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.soundVolume * 100)}
                onChange={(e) => patchSettings({ soundVolume: Number(e.target.value) / 100 })}
                className="flex-1"
              />
              <span className="tabular w-12 text-end text-sm text-[var(--ink-dim)]">
                {Math.round(settings.soundVolume * 100)}%
              </span>
            </div>
            <button
              onClick={() => playChime(settings.soundVolume)}
              className="mt-3 w-full rounded-xl border border-[var(--card-line)] px-4 py-2.5 text-sm font-medium transition active:bg-white/10"
            >
              {text('Test the chime', 'اختبار النغمة')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
