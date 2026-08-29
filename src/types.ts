// ─── ConverT CT-505 · shared domain types ────────────────────────────────────

export type FormatId =
  | 'wav' | 'flac' | 'mp3' | 'aac' | 'alac'
  | 'aiff' | 'ogg' | 'opus' | 'wv' | 'wma';

export type BitDepth = 16 | 24 | '32f';
export type BitDepthChoice = 'keep' | BitDepth;
export type RateChoice = 'keep' | number;
export type ChannelsChoice = 'keep' | 1 | 2;

/** swresample dither methods (applied only on true bit-depth reduction). */
export type DitherChoice =
  | 'auto' | 'off'
  | 'triangular_hp' | 'triangular' | 'rectangular'
  | 'shibata' | 'low_shibata' | 'high_shibata'
  | 'lipshitz' | 'f_weighted' | 'improved_e_weighted';

/** EBU R128 two-pass loudness normalization target (LUFS) or off. */
export type NormChoice = 'off' | -14 | -16 | -18 | -23;

export interface Preset {
  id: string;
  name: string;
  factory?: boolean;
  format: FormatId;
  /** id of a QualityValue within the format */
  quality: string;
  rate: RateChoice;
  depth: BitDepthChoice;
  channels: ChannelsChoice;
  dither: DitherChoice;
  norm: NormChoice;
  gainDb: number;
}

// ─── probe ───────────────────────────────────────────────────────────────────

export interface ProbeInfo {
  container?: string;
  codec?: string;
  sampleRate?: number;
  channels?: number;
  /** integer bits, or 'float' (typical for lossy decode) */
  bitDepth?: number | 'float';
  bitrateKbps?: number;
  durationSec?: number;
  lossless: boolean;
  hasCoverArt: boolean;
  isVideo: boolean;
  tags: Record<string, string>;
}

// ─── jobs / queue ────────────────────────────────────────────────────────────

export type FileStatus =
  | 'probing' | 'ready' | 'queued' | 'converting' | 'done' | 'error';

export interface ConvertResult {
  url: string;
  size: number;
  outName: string;
  mime: string;
  badges: string[];
  elapsedMs: number;
  /** signature of the preset used, so a changed patch re-queues done files */
  presetSig: string;
}

export interface FileEntry {
  id: string;
  file: File;
  name: string;
  size: number;
  status: FileStatus;
  probe?: ProbeInfo;
  progress: number; // 0..1 while converting
  phase?: 'analyze' | 'encode';
  result?: ConvertResult;
  error?: string;
}

export type LcdPage = 'file' | 'preset' | 'sys' | 'log';
export type EngineState = 'boot' | 'loading' | 'ready' | 'error';

export interface LoudnormMeasured {
  input_i: number;
  input_tp: number;
  input_lra: number;
  input_thresh: number;
  target_offset: number;
}
