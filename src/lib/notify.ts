import { PRAYER_META, type PrayerKey } from './prayer';
import { playChime } from './chime';

/**
 * Browser alarms for prayer times.
 *
 * Timers only run while the page is alive, so this is a reliable alert for a
 * tab left open and nothing more. Waking a closed phone needs Web Push behind a
 * service worker — and on iOS, the app installed to the home screen first. The
 * UI says so rather than implying an alarm clock.
 */

export type NotifyPermission = 'unsupported' | 'default' | 'granted' | 'denied';

export function notifyPermission(): NotifyPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as NotifyPermission;
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return (await Notification.requestPermission()) as NotifyPermission;
  } catch {
    return 'denied';
  }
}

function show(title: string, body: string) {
  try {
    const notification = new Notification(title, {
      body,
      tag: title,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });
    setTimeout(() => notification.close(), 60_000);
  } catch {
    // Some browsers refuse construction outside a service worker; nothing to do.
  }
}

export interface Alarm {
  key: PrayerKey;
  at: Date;
  /** Minutes before the time, or 0 for the moment itself. */
  lead: number;
  label: string;
}

/**
 * Arms timers for the given alarms and returns a cleanup function. setTimeout
 * saturates past ~24.8 days, which no prayer alarm ever reaches, so a plain
 * timer per alarm is safe here.
 */
export interface AlarmOptions {
  sound: boolean;
  volume: number;
}

export function scheduleAlarms(
  alarms: Alarm[],
  timeFormatted: (date: Date) => string,
  options: AlarmOptions = { sound: false, volume: 0.6 },
): () => void {
  // A chime alone is worth scheduling even when notifications are refused.
  if (notifyPermission() !== 'granted' && !options.sound) return () => {};

  const now = Date.now();
  const timers = alarms
    .filter((alarm) => alarm.at.getTime() - alarm.lead * 60_000 > now)
    .map((alarm) => {
      const fireAt = alarm.at.getTime() - alarm.lead * 60_000;
      return setTimeout(() => {
        const name = PRAYER_META[alarm.key].en;
        if (options.sound) playChime(options.volume);
        if (notifyPermission() !== 'granted') return;
        show(
          alarm.lead > 0 ? `${name} in ${alarm.lead} min` : `${name} — ${alarm.label}`,
          alarm.lead > 0
            ? `${alarm.label} at ${timeFormatted(alarm.at)}`
            : `It is ${timeFormatted(alarm.at)}`,
        );
      }, fireAt - now);
    });

  return () => timers.forEach(clearTimeout);
}
