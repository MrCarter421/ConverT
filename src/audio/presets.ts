// ─── ConverT CT-505 · patch memory (presets) ─────────────────────────────────

import type { Preset } from '../types';

let uid = 0;
export const newId = (p = 'u') => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`;

const P = (name: string, over: Partial<Preset>): Preset => ({
  id: `f-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  name,
  factory: true,
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

/** Factory bank — groovebox patch style. */
export const FACTORY_PRESETS: Preset[] = [
  P('MP3 CLUB 320', { format: 'mp3', quality: 'cbr320' }),
  P('MP3 TOUR V0', { format: 'mp3', quality: 'v0' }),
  P('MP3 POCKET V2', { format: 'mp3', quality: 'v2' }),
  P('AAC MODERN 256', { format: 'aac', quality: 'b256' }),
  P('OPUS STREAM 192', { format: 'opus', quality: 'b192' }),
  P('OPUS VOICE 96', { format: 'opus', quality: 'b96', channels: 1 }),
  P('OGG ACID Q8', { format: 'ogg', quality: 'q8' }),
  P('FLAC ARCHIVE', { format: 'flac', quality: 'c8' }),
  P('FLAC CD 16/44', { format: 'flac', quality: 'c8', rate: 44100, depth: 16, dither: 'shibata' }),
  P('FLAC STUDIO 24/96', { format: 'flac', quality: 'c8', rate: 96000, depth: 24 }),
  P('WAV CD MASTER', { format: 'wav', quality: 'pcm', rate: 44100, depth: 16, dither: 'shibata' }),
  P('WAV SESSION 24/48', { format: 'wav', quality: 'pcm', rate: 48000, depth: 24 }),
  P('WAV HIRES 24/96', { format: 'wav', quality: 'pcm', rate: 96000, depth: 24 }),
  P('WAV FLOAT 32', { format: 'wav', quality: 'pcm', depth: '32f' }),
  P('AIFF SAMPLER 44', { format: 'aiff', quality: 'pcm', rate: 44100, depth: 16, dither: 'triangular_hp' }),
  P('ALAC POCKET HIFI', { format: 'alac', quality: 'alac' }),
  P('WV PACKRAT MAX', { format: 'wv', quality: 'c8' }),
  P('WMA TIMEWARP 160', { format: 'wma', quality: 'b160' }),
  P('LOUD -14 STREAM', { format: 'mp3', quality: 'cbr320', norm: -14 }),
  P('EBU -23 BROADCAST', { format: 'wav', quality: 'pcm', rate: 48000, depth: 24, norm: -23 }),
];

export const DEFAULT_PRESET: Preset = { ...FACTORY_PRESETS[0] };

export function presetsEqual(a: Preset, b: Preset): boolean {
  return (
    a.format === b.format && a.quality === b.quality && a.rate === b.rate &&
    a.depth === b.depth && a.channels === b.channels && a.dither === b.dither &&
    a.norm === b.norm && a.gainDb === b.gainDb
  );
}

/** auto-name for user patches: "MP3 V0 44.1K" style */
export function autoName(p: Preset): string {
  const bits = [p.format.toUpperCase(), p.quality.toUpperCase().replace(/^(CBR|B)/, '')];
  if (p.rate !== 'keep') bits.push(`${(p.rate / 1000).toString().replace('.0', '')}K`);
  if (p.depth !== 'keep') bits.push(p.depth === '32f' ? '32F' : `${p.depth}B`);
  if (p.norm !== 'off') bits.push(`${p.norm}LU`);
  return bits.join(' ').slice(0, 18);
}
