// ─── ConverT · preset library ────────────────────────────────────────────────

import type { Preset, PresetGroup } from '../types';
import { FORMATS, qualityOf } from './formats';
import { fmtRate } from '../util/fmt';

let uid = 0;
export const newId = (p = 'u') => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`;

const P = (name: string, group: PresetGroup, over: Partial<Preset>): Preset => ({
  id: `f-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  name,
  factory: true,
  group,
  format: 'mp3',
  quality: 'cbr320',
  rate: 'keep',
  depth: 'keep',
  channels: 'keep',
  dither: 'auto',
  norm: 'off',
  gainDb: 0,
  ...over,
});

/** Shelves of the preset window, in display order. */
export const PRESET_GROUPS: { id: PresetGroup; label: string; hint: string }[] = [
  { id: 'lossy', label: 'Everyday', hint: 'small files, great sound' },
  { id: 'lossless', label: 'Lossless', hint: 'bit-for-bit archive' },
  { id: 'studio', label: 'Studio & Hi-Res', hint: '24-bit and up' },
  { id: 'loudness', label: 'Loudness', hint: 'EBU R128 two-pass' },
  { id: 'mine', label: 'My presets', hint: 'saved by you' },
];

/** Factory library. Never mutated; user presets live alongside in localStorage. */
export const FACTORY_PRESETS: Preset[] = [
  P('MP3 · 320 kbps', 'lossy', { format: 'mp3', quality: 'cbr320' }),
  P('MP3 · V0 best VBR', 'lossy', { format: 'mp3', quality: 'v0' }),
  P('MP3 · V2 portable', 'lossy', { format: 'mp3', quality: 'v2' }),
  P('AAC · 256 kbps', 'lossy', { format: 'aac', quality: 'b256' }),
  P('Opus · 192 kbps', 'lossy', { format: 'opus', quality: 'b192' }),
  P('Opus · voice 96 mono', 'lossy', { format: 'opus', quality: 'b96', channels: 1 }),
  P('Ogg Vorbis · Q8', 'lossy', { format: 'ogg', quality: 'q8' }),
  P('WMA · 160 kbps retro', 'lossy', { format: 'wma', quality: 'b160' }),

  P('FLAC · keep source', 'lossless', { format: 'flac', quality: 'c8' }),
  P('FLAC · CD 16/44.1', 'lossless', { format: 'flac', quality: 'c8', rate: 44100, depth: 16, dither: 'shibata' }),
  P('ALAC · keep source', 'lossless', { format: 'alac', quality: 'alac' }),
  P('WavPack · max', 'lossless', { format: 'wv', quality: 'c8' }),
  P('WAV · CD 16/44.1', 'lossless', { format: 'wav', quality: 'pcm', rate: 44100, depth: 16, dither: 'shibata' }),
  P('AIFF · CD 16/44.1', 'lossless', { format: 'aiff', quality: 'pcm', rate: 44100, depth: 16, dither: 'triangular_hp' }),

  P('FLAC · 24/96 hi-res', 'studio', { format: 'flac', quality: 'c8', rate: 96000, depth: 24 }),
  P('WAV · 24/48 session', 'studio', { format: 'wav', quality: 'pcm', rate: 48000, depth: 24 }),
  P('WAV · 24/96 hi-res', 'studio', { format: 'wav', quality: 'pcm', rate: 96000, depth: 24 }),
  P('WAV · 32-bit float', 'studio', { format: 'wav', quality: 'pcm', depth: '32f' }),

  P('Streaming · −14 LUFS MP3', 'loudness', { format: 'mp3', quality: 'cbr320', norm: -14 }),
  P('Podcast · −16 LUFS AAC', 'loudness', { format: 'aac', quality: 'b128', norm: -16 }),
  P('Broadcast · EBU −23 WAV', 'loudness', { format: 'wav', quality: 'pcm', rate: 48000, depth: 24, norm: -23 }),
];

export const DEFAULT_PRESET: Preset = { ...FACTORY_PRESETS[0] };

/** The fields that change the output. Names, ids and shelves don't. */
export function dspFields(p: Preset) {
  return {
    format: p.format, quality: p.quality, rate: p.rate, depth: p.depth,
    channels: p.channels, dither: p.dither, norm: p.norm, gainDb: p.gainDb,
  };
}

export function presetsEqual(a: Preset, b: Preset): boolean {
  return JSON.stringify(dspFields(a)) === JSON.stringify(dspFields(b));
}

// ── plain-language descriptions ──────────────────────────────────────────────

const depthText = (d: Preset['depth']) => (d === '32f' ? '32-bit float' : `${d}-bit`);

/** display-voice quality text → plain language: "VBR -V0 ~245K" → "VBR V0 · ~245 kbps" */
function qualityText(lcd: string): string {
  if (lcd.startsWith('COMPRESS')) return lcd.toLowerCase().replace('compress', 'compression');
  return lcd
    .replace(/(\d+)K\b/g, '$1 kbps')
    .replace('VBR -V', 'VBR V')
    .replace(/ (~?\d+ kbps)$/, ' · $1')
    .replace(/^(CBR|AAC-LC|OPUS|WMA) · /, '$1 ')
    .replace('VORBIS', 'Vorbis')
    .replace('OPUS', 'Opus');
}

/** "MP3 · 320 kbps", "FLAC · 16-bit / 44.1 kHz", "WAV · keep source" */
export function presetTitle(p: Preset): string {
  const fmt = FORMATS[p.format];
  const head = fmt.knob === 'WV' ? 'WavPack' : fmt.knob;
  const bits: string[] = [];
  if (!fmt.lossless) {
    const qv = qualityOf(fmt, p.quality);
    bits.push(/^\d+$/.test(qv.knob) ? `${qv.knob} kbps` : qv.knob);
  }
  if (fmt.depths && p.depth !== 'keep') bits.push(depthText(p.depth));
  if (p.rate !== 'keep') bits.push(`${fmtRate(p.rate).replace('K', '')} kHz`);
  if (fmt.lossless && bits.length === 0) bits.push('keep source');
  return `${head} · ${bits.join(' / ')}`;
}

/** secondary line: the less obvious settings, or how the encoder runs */
export function presetDetail(p: Preset): string {
  const fmt = FORMATS[p.format];
  const qv = qualityOf(fmt, p.quality);
  const bits: string[] = [];
  if (fmt.qualities.length > 1) bits.push(qualityText(qv.lcd));
  else bits.push(qv.id === 'pcm' ? 'uncompressed PCM' : fmt.lossless ? 'lossless' : qualityText(qv.lcd));
  if (p.channels !== 'keep') bits.push(p.channels === 1 ? 'mono' : 'stereo');
  if (p.norm !== 'off') bits.push(`${p.norm} LUFS`);
  if (p.gainDb !== 0) bits.push(`${p.gainDb > 0 ? '+' : ''}${p.gainDb} dB`);
  if (fmt.depths && p.dither !== 'auto' && p.dither !== 'off') bits.push(`${ditherLabel(p.dither)} dither`);
  if (fmt.depths && p.dither === 'off') bits.push('no dither');
  return bits.join(' · ');
}

export function ditherLabel(d: Preset['dither']): string {
  switch (d) {
    case 'auto': return 'Auto';
    case 'off': return 'Off';
    case 'triangular_hp': return 'TPDF high-pass';
    case 'triangular': return 'TPDF';
    case 'rectangular': return 'Rectangular';
    case 'shibata': return 'Shibata';
    case 'low_shibata': return 'Low Shibata';
    case 'high_shibata': return 'High Shibata';
    case 'lipshitz': return 'Lipshitz';
    case 'f_weighted': return 'F-weighted';
    case 'improved_e_weighted': return 'Improved E-weighted';
  }
}

/** default name for a user preset */
export function autoName(p: Preset): string {
  return presetTitle(p).slice(0, 40);
}
