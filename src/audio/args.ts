// ─── ConverT CT-505 · the gold cables ────────────────────────────────────────
// Builds FFmpeg invocations with audiophile discipline:
//   · never touch samples unless the preset demands it
//   · resample via soxr @ 28-bit precision when available, else swresample
//     with a 256-tap filter — both forced to 64-bit float internally
//   · noise-shaped dither only on true bit-depth reduction to 16-bit
//   · EBU R128 loudness via measured two-pass linear loudnorm
//   · metadata + cover art carried across when the target supports it

import type {
  BitDepth, LoudnormMeasured, Preset, ProbeInfo,
} from '../types';
import {
  FORMATS, autoDepth, coerceRate, isLosslessCodec, qualityOf, ratesForFormat,
} from './formats';

export interface ConversionPlan {
  format: ReturnType<typeof planFormat>;
  inputName: string;
  outputName: string;
  /** args for the loudnorm measurement pass, or null when norm is off */
  measureArgs: string[] | null;
  mainArgs: (measured: LoudnormMeasured | null) => string[];
  /** same invocation without cover-art mapping (fallback on mux failure) */
  mainArgsNoArt: (measured: LoudnormMeasured | null) => string[];
  withArt: boolean;
  badges: string[];
  effective: {
    rate: number;
    depth: BitDepth | null;
    channels: number;
    resampling: boolean;
    dither: string | null;
  };
}

function planFormat(preset: Preset) {
  return FORMATS[preset.format];
}

const clampGain = (g: number) => Math.max(-24, Math.min(24, Math.round(g * 2) / 2));

export function buildPlan(
  preset: Preset,
  probe: ProbeInfo | undefined,
  opts: { inputName: string; soxr: boolean },
): ConversionPlan {
  const fmt = FORMATS[preset.format];
  const quality = qualityOf(fmt, preset.quality);
  const badges: string[] = [];

  const srcRate = probe?.sampleRate ?? 44100;
  const srcChannels = probe?.channels ?? 2;
  const srcBits = probe?.bitDepth;
  const srcLossless = probe ? probe.lossless || isLosslessCodec(probe.codec) : false;

  // ── sample rate ──
  const allowed = fmt.rates ?? null;
  let targetRate: number | null = null; // null → untouched
  if (preset.rate === 'keep') {
    if (allowed && !allowed.includes(srcRate)) targetRate = coerceRate(srcRate, allowed);
  } else {
    let want = preset.rate;
    if (allowed && !allowed.includes(want)) want = coerceRate(want, allowed);
    if (!allowed && !ratesForFormat(fmt).includes(want)) want = srcRate;
    if (want !== srcRate) targetRate = want;
  }
  const effectiveRate = targetRate ?? srcRate;

  // ── bit depth (lossless targets only) ──
  let depth: BitDepth | null = null;
  if (fmt.depths) {
    depth = preset.depth === 'keep'
      ? autoDepth(probe, fmt.depths)
      : (fmt.depths.includes(preset.depth) ? preset.depth : autoDepth(probe, fmt.depths));
  }

  // ── dither: only meaningful when truly reducing to 16-bit int ──
  const reducingTo16 =
    depth === 16 &&
    (srcBits === 'float' || srcBits === undefined || (typeof srcBits === 'number' && srcBits > 16) ||
      targetRate !== null); // requantization after resampling deserves dither too
  let dither: string | null = null;
  if (reducingTo16 && preset.dither !== 'off') {
    dither = preset.dither === 'auto'
      ? (effectiveRate === 44100 || effectiveRate === 48000 ? 'shibata' : 'triangular_hp')
      : preset.dither;
    // shibata noise-shaping curves only exist for 44.1/48k families
    if (dither.includes('shibata') && effectiveRate !== 44100 && effectiveRate !== 48000) {
      dither = 'triangular_hp';
    }
  }

  // ── channels ──
  const wantChannels = preset.channels === 'keep' ? null
    : preset.channels === srcChannels ? null : preset.channels;
  const effectiveChannels = wantChannels ?? srcChannels;

  const gainDb = clampGain(preset.gainDb);
  const normOn = preset.norm !== 'off';

  // ── filter chain ──
  const filters: string[] = [];
  if (gainDb !== 0) filters.push(`volume=${gainDb}dB:precision=double`);

  const loudnormBase = normOn
    ? `loudnorm=I=${preset.norm}:TP=-1.0:LRA=11`
    : null;

  const needAresample =
    targetRate !== null || dither !== null || wantChannels !== null || normOn;

  const codecInfo = fmt.codecFor && depth !== null ? fmt.codecFor(depth) : null;

  const aresample = (): string => {
    const p: string[] = [];
    // loudnorm internally runs at 192k — always pin the output rate behind it
    if (targetRate !== null || normOn) p.push(`out_sample_rate=${effectiveRate}`);
    // pin the layout whenever we know it: an unconstrained aresample output
    // breaks graph channel negotiation behind loudnorm
    if (wantChannels !== null || effectiveChannels <= 2) {
      p.push(`out_chlayout=${effectiveChannels === 1 ? 'mono' : 'stereo'}`);
    }
    if (targetRate !== null || normOn) {
      if (opts.soxr) {
        p.push('resampler=soxr', 'precision=28');
      } else {
        p.push('filter_size=256', 'cutoff=0.97');
      }
    }
    p.push('internal_sample_fmt=dblp'); // 64-bit float engine, always
    if (codecInfo && (dither !== null || targetRate !== null)) {
      p.push(`out_sample_fmt=${codecInfo.osf}`);
    }
    if (dither !== null) p.push(`dither_method=${dither}`);
    return `aresample=${p.join(':')}`;
  };

  const chain = (measured: LoudnormMeasured | null): string | null => {
    const parts = [...filters];
    if (loudnormBase) {
      let ln = loudnormBase;
      if (measured) {
        ln += `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
          `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
          `:offset=${measured.target_offset}:linear=true`;
      }
      parts.push(ln);
    }
    if (needAresample) parts.push(aresample());
    return parts.length ? parts.join(',') : null;
  };

  // ── codec args ──
  const codecArgs: string[] = [];
  if (codecInfo) {
    codecArgs.push('-c:a', codecInfo.codec, ...(codecInfo.extra ?? []));
  } else if (fmt.codec) {
    codecArgs.push('-c:a', fmt.codec);
  }
  codecArgs.push(...quality.args, ...(fmt.baseArgs ?? []));

  // ── art / metadata ──
  const withArt = Boolean(fmt.coverArt && probe?.hasCoverArt && !probe?.isVideo);
  const outputName = `out.${fmt.ext}`;

  const assemble = (measured: LoudnormMeasured | null, art: boolean): string[] => {
    const af = chain(measured);
    return [
      '-hide_banner', '-nostdin',
      '-i', opts.inputName,
      '-map', '0:a:0',
      ...(art
        ? ['-map', '0:v:0?', '-c:v', 'copy', '-disposition:v:0', 'attached_pic']
        : ['-vn']),
      '-map_metadata', '0',
      ...(af ? ['-af', af] : []),
      ...codecArgs,
      '-f', fmt.muxer,
      '-y', outputName,
    ];
  };

  const measureArgs = normOn
    ? [
        '-hide_banner', '-nostdin',
        '-i', opts.inputName,
        '-map', '0:a:0', '-vn',
        '-af', [...filters, `${loudnormBase}:print_format=json`].join(','),
        '-f', 'null', '-',
      ]
    : null;

  // ── LCD badges ──
  const touched = gainDb !== 0 || normOn || targetRate !== null || dither !== null || wantChannels !== null;
  if (fmt.lossless && srcLossless && !touched) badges.push('BIT PERFECT');
  if (!fmt.lossless && probe && !srcLossless) badges.push('GEN LOSS!');
  if (fmt.lossless && probe && !srcLossless) badges.push('LOSSY SRC');
  if (targetRate !== null) badges.push(opts.soxr ? 'SOXR 28BIT' : 'SWR 256TAP');
  if (dither) badges.push(`DITHER ${dither === 'triangular_hp' ? 'TPDF-HP' : dither.toUpperCase().replace('_', ' ').slice(0, 10)}`);
  if (normOn) badges.push(`R128 ${preset.norm}LU`);
  if (probe?.isVideo) badges.push('VIDEO SRC');
  if (needAresample) badges.push('FLOAT64 DSP');

  return {
    format: fmt,
    inputName: opts.inputName,
    outputName,
    measureArgs,
    mainArgs: (m) => assemble(m, withArt),
    mainArgsNoArt: (m) => assemble(m, false),
    withArt,
    badges,
    effective: {
      rate: effectiveRate,
      depth,
      channels: effectiveChannels,
      resampling: targetRate !== null,
      dither,
    },
  };
}

/** Parse the JSON block loudnorm prints during the measurement pass.
 *  Line prefixes vary between builds, so scrape each key directly. */
export function parseLoudnorm(logs: string[]): LoudnormMeasured | null {
  const text = logs.join('\n');
  const grab = (key: string): number | null => {
    const m = text.match(new RegExp(`"${key}"\\s*:\\s*"?(-?[\\d.]+|-?inf)"?`, 'i'));
    if (!m) return null;
    if (m[1].toLowerCase().includes('inf')) return -99;
    const x = parseFloat(m[1]);
    return Number.isFinite(x) ? x : null;
  };
  const input_i = grab('input_i');
  const input_tp = grab('input_tp');
  const input_lra = grab('input_lra');
  const input_thresh = grab('input_thresh');
  const target_offset = grab('target_offset');
  if (input_i === null || input_tp === null || input_lra === null || input_thresh === null) {
    return null;
  }
  return {
    input_i,
    input_tp,
    input_lra: Math.max(0, input_lra),
    input_thresh,
    target_offset: target_offset ?? 0,
  };
}
