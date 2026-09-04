import { ayahAudioUrl, type ReciterId } from './quran';

/**
 * Play one ayah with leading/trailing silence cut, so handing off to the next
 * (or stopping) does not sit in dead air. Files are fetched from EveryAyah
 * because that host allows CORS; the Islamic Network CDN does not.
 */

const SILENCE = 0.016;
const PAD_S = 0.01;
const cache = new Map<string, AudioBuffer>();

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let token = 0;

function ac(): AudioContext {
  ctx ??= new AudioContext();
  return ctx;
}

function trim(buffer: AudioBuffer, audio: AudioContext): AudioBuffer {
  const data = buffer.getChannelData(0);
  let a = 0;
  let b = data.length - 1;
  while (a < b && Math.abs(data[a]) < SILENCE) a += 1;
  while (b > a && Math.abs(data[b]) < SILENCE) b -= 1;
  const pad = Math.floor(buffer.sampleRate * PAD_S);
  a = Math.max(0, a - pad);
  b = Math.min(data.length - 1, b + pad);
  const len = b - a + 1;
  if (len < buffer.sampleRate * 0.08) return buffer;
  const out = audio.createBuffer(buffer.numberOfChannels, len, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    out.getChannelData(c).set(buffer.getChannelData(c).subarray(a, b + 1));
  }
  return out;
}

async function decode(url: string): Promise<AudioBuffer> {
  const hit = cache.get(url);
  if (hit) return hit;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`audio ${res.status}`);
  const raw = await res.arrayBuffer();
  const audio = ac();
  const decoded = await audio.decodeAudioData(raw.slice(0));
  const cut = trim(decoded, audio);
  cache.set(url, cut);
  if (cache.size > 12) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return cut;
}

export function stopAyah(): void {
  token += 1;
  if (source) {
    try {
      source.onended = null;
      source.stop();
    } catch {
      /* already stopped */
    }
    source = null;
  }
}

export async function playAyah(opts: {
  reciter: ReciterId;
  surah: number;
  ayah: number;
  onEnded?: () => void;
}): Promise<void> {
  const mine = (token += 1);
  const audio = ac();
  if (audio.state === 'suspended') await audio.resume();
  if (mine !== token) return;

  const url = ayahAudioUrl(opts.reciter, opts.surah, opts.ayah);
  const buffer = await decode(url);
  if (mine !== token) return;

  if (source) {
    try {
      source.onended = null;
      source.stop();
    } catch {
      /* already stopped */
    }
  }

  const src = audio.createBufferSource();
  src.buffer = buffer;
  src.connect(audio.destination);
  src.onended = () => {
    if (token !== mine) return;
    source = null;
    opts.onEnded?.();
  };
  source = src;
  src.start();
}
