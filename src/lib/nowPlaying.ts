/**
 * Putting the next prayer on the lock screen and the Dynamic Island.
 *
 * A web page cannot post a Live Activity — that needs a native app and
 * ActivityKit. What it *can* do is become the thing that is playing: iOS shows
 * whatever holds the media session in the Dynamic Island, on the lock screen
 * and in Control Centre. So the app plays silence on a loop and keeps the
 * now-playing metadata pointed at the next prayer.
 *
 * Being honest about the cost: this holds the audio session, so it takes over
 * the media controls and will stop your music. iOS also suspends it eventually.
 * It is opt-in for exactly those reasons.
 */

let audio: HTMLAudioElement | null = null;

/** A fraction of a second of silence, built rather than shipped. */
function silentWav(): string {
  const sampleRate = 8000;
  const samples = sampleRate / 2;
  const size = 44 + samples * 2;
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  view.setUint32(4, size - 8, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, samples * 2, true);
  // The sample data is already zeroes, which is silence.

  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export const nowPlayingSupported =
  typeof navigator !== 'undefined' && 'mediaSession' in navigator;

export interface NowPlaying {
  prayer: string;
  at: string;
  remaining: string;
  place: string;
}

/** Must be called from a user gesture: browsers refuse audio otherwise. */
export async function startNowPlaying(info: NowPlaying): Promise<boolean> {
  if (!nowPlayingSupported) return false;
  try {
    if (!audio) {
      audio = new Audio(silentWav());
      audio.loop = true;
      audio.volume = 0;
      // Keeps iOS treating this as ongoing playback rather than a stray sound.
      audio.setAttribute('playsinline', '');
    }
    await audio.play();
    update(info);
    return true;
  } catch {
    return false;
  }
}

export function stopNowPlaying(): void {
  audio?.pause();
  if (navigator.mediaSession) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }
}

export function isNowPlaying(): boolean {
  return Boolean(audio && !audio.paused);
}

/** Refresh what the lock screen shows. Cheap; call it once a minute. */
export function update(info: NowPlaying): void {
  if (!navigator.mediaSession) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${info.prayer} · ${info.at}`,
      artist: info.remaining,
      album: info.place,
      artwork: [{ src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml' }],
    });
    navigator.mediaSession.playbackState = 'playing';
  } catch {
    // Metadata is a nicety; never let it break the page.
  }
}
