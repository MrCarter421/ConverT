// ─── ConverT CT-505 · format registry ────────────────────────────────────────
// Every target format is declared here. Adding a new format = adding an entry;
// knobs, presets, LCD readouts and the arg builder all derive from this table.

import type { BitDepth, FormatId, ProbeInfo } from '../types';

export interface QualityValue {
  id: string;
  /** short label printed on the knob scale */
  knob: string;
  /** longer label for the LCD */
  lcd: string;
  /** encoder-quality args (bitrate / vbr / compression level) */
  args: string[];
}

export interface LosslessCodec {
  codec: string;
  extra?: string[];
  /** sample format the filter chain should deliver (dither target) */
  osf: 's16' | 's32' | 'flt';
}

export interface FormatDef {
  id: FormatId;
  /** short label on the FORMAT knob */
  knob: string;
  name: string;
  ext: string;
  mime: string;
  muxer: string;
  lossless: boolean;
  coverArt: boolean;
  /** allowed sample rates; undefined = unrestricted */
  rates?: number[];
  /** selectable bit depths; undefined = encoder-fixed (lossy) */
  depths?: BitDepth[];
  qualities: QualityValue[];
  defaultQuality: string;
  /** codec for lossy formats */
  codec?: string;
  /** always-applied extra args */
  baseArgs?: string[];
  /** codec resolution for lossless formats */
  codecFor?: (depth: BitDepth) => LosslessCodec;
}

const q = (id: string, knob: string, lcd: string, ...args: string[]): QualityValue =>
  ({ id, knob, lcd, args });

const MP3_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];
const OPUS_RATES = [8000, 12000, 16000, 24000, 48000];
const AAC_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000, 64000, 88200, 96000];
const WMA_RATES = [8000, 11025, 16000, 22050, 32000, 44100, 48000];
const VORBIS_RATES = [8000, 11025, 16000, 22050, 32000, 44100, 48000, 88200, 96000, 176400, 192000];

export const FORMATS: Record<FormatId, FormatDef> = {
  wav: {
    id: 'wav', knob: 'WAV', name: 'WAV · PCM', ext: 'wav', mime: 'audio/wav',
    muxer: 'wav', lossless: true, coverArt: false,
    depths: [16, 24, '32f'],
    qualities: [q('pcm', 'PCM', 'LINEAR PCM')],
    defaultQuality: 'pcm',
    baseArgs: ['-rf64', 'auto'],
    codecFor: (d) =>
      d === 16 ? { codec: 'pcm_s16le', osf: 's16' }
      : d === 24 ? { codec: 'pcm_s24le', osf: 's32' }
      : { codec: 'pcm_f32le', osf: 'flt' },
  },

  aiff: {
    id: 'aiff', knob: 'AIFF', name: 'AIFF · PCM', ext: 'aiff', mime: 'audio/aiff',
    muxer: 'aiff', lossless: true, coverArt: false,
    depths: [16, 24, '32f'],
    qualities: [q('pcm', 'PCM', 'LINEAR PCM')],
    defaultQuality: 'pcm',
    codecFor: (d) =>
      d === 16 ? { codec: 'pcm_s16be', osf: 's16' }
      : d === 24 ? { codec: 'pcm_s24be', osf: 's32' }
      : { codec: 'pcm_f32be', osf: 'flt' },
  },

  flac: {
    id: 'flac', knob: 'FLAC', name: 'FLAC LOSSLESS', ext: 'flac', mime: 'audio/flac',
    muxer: 'flac', lossless: true, coverArt: true,
    depths: [16, 24],
    qualities: [
      q('c0', 'FAST', 'COMPRESS 0 FAST', '-compression_level', '0'),
      q('c5', 'NORM', 'COMPRESS 5', '-compression_level', '5'),
      q('c8', 'HIGH', 'COMPRESS 8', '-compression_level', '8'),
      q('c12', 'MAX', 'COMPRESS 12 MAX', '-compression_level', '12'),
    ],
    defaultQuality: 'c8',
    codecFor: (d) =>
      d === 24
        ? { codec: 'flac', extra: ['-sample_fmt', 's32', '-bits_per_raw_sample', '24'], osf: 's32' }
        : { codec: 'flac', extra: ['-sample_fmt', 's16'], osf: 's16' },
  },

  alac: {
    id: 'alac', knob: 'ALAC', name: 'APPLE LOSSLESS', ext: 'm4a', mime: 'audio/mp4',
    muxer: 'ipod', lossless: true, coverArt: true,
    depths: [16, 24],
    qualities: [q('alac', 'ALAC', 'APPLE LOSSLESS')],
    defaultQuality: 'alac',
    baseArgs: ['-movflags', '+faststart'],
    codecFor: (d) =>
      d === 24
        ? { codec: 'alac', extra: ['-sample_fmt', 's32p', '-bits_per_raw_sample', '24'], osf: 's32' }
        : { codec: 'alac', extra: ['-sample_fmt', 's16p'], osf: 's16' },
  },

  wv: {
    id: 'wv', knob: 'WV', name: 'WAVPACK', ext: 'wv', mime: 'audio/x-wavpack',
    muxer: 'wv', lossless: true, coverArt: false,
    depths: [16, 24, '32f'],
    qualities: [
      q('c1', 'FAST', 'COMPRESS FAST', '-compression_level', '1'),
      q('c4', 'NORM', 'COMPRESS NORM', '-compression_level', '4'),
      q('c8', 'MAX', 'COMPRESS MAX', '-compression_level', '8'),
    ],
    defaultQuality: 'c4',
    codecFor: (d) =>
      d === 16 ? { codec: 'wavpack', extra: ['-sample_fmt', 's16p'], osf: 's16' }
      : d === 24 ? { codec: 'wavpack', extra: ['-sample_fmt', 's32p', '-bits_per_raw_sample', '24'], osf: 's32' }
      : { codec: 'wavpack', extra: ['-sample_fmt', 'fltp'], osf: 'flt' },
  },

  mp3: {
    id: 'mp3', knob: 'MP3', name: 'MP3 · LAME', ext: 'mp3', mime: 'audio/mpeg',
    muxer: 'mp3', lossless: false, coverArt: true,
    rates: MP3_RATES,
    codec: 'libmp3lame',
    // -compression_level 0 == lame -q0: best psychoacoustics, damn the CPU
    baseArgs: ['-compression_level', '0', '-id3v2_version', '3', '-write_id3v1', '1'],
    qualities: [
      q('cbr128', '128', 'CBR 128K', '-b:a', '128k'),
      q('cbr192', '192', 'CBR 192K', '-b:a', '192k'),
      q('cbr256', '256', 'CBR 256K', '-b:a', '256k'),
      q('cbr320', '320', 'CBR 320K', '-b:a', '320k'),
      q('v4', 'V4', 'VBR -V4 ~165K', '-q:a', '4'),
      q('v2', 'V2', 'VBR -V2 ~190K', '-q:a', '2'),
      q('v0', 'V0', 'VBR -V0 ~245K', '-q:a', '0'),
    ],
    defaultQuality: 'cbr320',
  },

  aac: {
    id: 'aac', knob: 'AAC', name: 'AAC · M4A', ext: 'm4a', mime: 'audio/mp4',
    muxer: 'ipod', lossless: false, coverArt: true,
    rates: AAC_RATES,
    codec: 'aac',
    baseArgs: ['-movflags', '+faststart'],
    qualities: [
      q('b96', '96', 'AAC-LC 96K', '-b:a', '96k'),
      q('b128', '128', 'AAC-LC 128K', '-b:a', '128k'),
      q('b192', '192', 'AAC-LC 192K', '-b:a', '192k'),
      q('b256', '256', 'AAC-LC 256K', '-b:a', '256k'),
      q('b320', '320', 'AAC-LC 320K', '-b:a', '320k'),
    ],
    defaultQuality: 'b256',
  },

  ogg: {
    id: 'ogg', knob: 'OGG', name: 'OGG VORBIS', ext: 'ogg', mime: 'audio/ogg',
    muxer: 'ogg', lossless: false, coverArt: false,
    rates: VORBIS_RATES,
    codec: 'libvorbis',
    qualities: [
      q('q2', 'Q2', 'VORBIS Q2 ~96K', '-q:a', '2'),
      q('q4', 'Q4', 'VORBIS Q4 ~128K', '-q:a', '4'),
      q('q6', 'Q6', 'VORBIS Q6 ~192K', '-q:a', '6'),
      q('q8', 'Q8', 'VORBIS Q8 ~256K', '-q:a', '8'),
      q('q10', 'Q10', 'VORBIS Q10 ~500K', '-q:a', '10'),
    ],
    defaultQuality: 'q8',
  },

  opus: {
    id: 'opus', knob: 'OPUS', name: 'OPUS', ext: 'opus', mime: 'audio/ogg',
    muxer: 'opus', lossless: false, coverArt: false,
    rates: OPUS_RATES,
    // NOTE: libopus encode crashes the current @ffmpeg/core wasm build
    // ("Error submitting audio frame to the encoder" → OOB), so we use
    // FFmpeg's native CELT encoder. Swap back to libopus when the core heals.
    codec: 'opus',
    baseArgs: ['-strict', '-2'],
    qualities: [
      q('b96', '96', 'OPUS 96K', '-b:a', '96k'),
      q('b128', '128', 'OPUS 128K', '-b:a', '128k'),
      q('b160', '160', 'OPUS 160K', '-b:a', '160k'),
      q('b192', '192', 'OPUS 192K', '-b:a', '192k'),
      q('b256', '256', 'OPUS 256K', '-b:a', '256k'),
      q('b320', '320', 'OPUS 320K', '-b:a', '320k'),
    ],
    defaultQuality: 'b192',
  },

  wma: {
    id: 'wma', knob: 'WMA', name: 'WMA V2 RETRO', ext: 'wma', mime: 'audio/x-ms-wma',
    muxer: 'asf', lossless: false, coverArt: false,
    rates: WMA_RATES,
    codec: 'wmav2',
    qualities: [
      q('b64', '64', 'WMA 64K', '-b:a', '64k'),
      q('b96', '96', 'WMA 96K', '-b:a', '96k'),
      q('b128', '128', 'WMA 128K', '-b:a', '128k'),
      q('b160', '160', 'WMA 160K', '-b:a', '160k'),
      q('b192', '192', 'WMA 192K', '-b:a', '192k'),
    ],
    defaultQuality: 'b160',
  },
};

/** knob ordering */
export const FORMAT_ORDER: FormatId[] = [
  'wav', 'aiff', 'flac', 'alac', 'wv', 'mp3', 'aac', 'ogg', 'opus', 'wma',
];

/** sample-rate knob positions (subset filtered per-format) */
export const RATE_CHOICES: number[] = [
  16000, 22050, 32000, 44100, 48000, 88200, 96000, 176400, 192000,
];

export function ratesForFormat(f: FormatDef): number[] {
  if (!f.rates) return RATE_CHOICES;
  return RATE_CHOICES.filter((r) => f.rates!.includes(r));
}

export function qualityOf(f: FormatDef, id: string): QualityValue {
  return f.qualities.find((v) => v.id === id) ?? f.qualities.find((v) => v.id === f.defaultQuality) ?? f.qualities[0];
}

/**
 * Pick the best allowed rate for a source rate: prefer integer-division family
 * (96k→48k, 88.2k→44.1k, 192k→48k) to keep resampling ratios clean.
 */
export function coerceRate(source: number, allowed: number[]): number {
  if (allowed.includes(source)) return source;
  // integer-division family first (96k→48k, 176.4k→44.1k): clean ratios
  for (let r = source; r >= 8000; r = r / 2) {
    if (allowed.includes(r)) return r;
  }
  // otherwise round UP to the nearest allowed rate (44.1k→48k for Opus) —
  // never throw away bandwidth that a higher legal rate could keep
  const above = allowed.filter((r) => r >= source);
  if (above.length) return Math.min(...above);
  return Math.max(...allowed);
}

/** 'keep' depth resolution: preserve everything we decoded. */
export function autoDepth(probe: ProbeInfo | undefined, supported: BitDepth[]): BitDepth {
  const src = probe?.bitDepth;
  let want: BitDepth;
  if (typeof src === 'number') want = src <= 16 ? 16 : 24;
  else want = 24; // float / unknown (lossy decode) → keep full decode precision
  if (supported.includes(want)) return want;
  return supported.includes(24) ? 24 : supported[supported.length - 1];
}

export const LOSSLESS_CODECS = new Set([
  'flac', 'alac', 'wavpack', 'tta', 'tak', 'mlp', 'truehd', 'ape', 'shorten',
  'wmalossless', 'ralf', 'als', 'mp4als',
]);

export function isLosslessCodec(codec?: string): boolean {
  if (!codec) return false;
  const c = codec.toLowerCase();
  return c.startsWith('pcm_') || LOSSLESS_CODECS.has(c);
}
