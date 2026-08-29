// ─── ConverT CT-505 · DSP core (ffmpeg.wasm engine) ──────────────────────────
// Engine abstraction: today a single-threaded ffmpeg.wasm core; the interface
// is deliberately narrow so a multithreaded core or a native backend can slot
// in later without touching the UI.

import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';
import type { LoudnormMeasured, Preset, ProbeInfo } from '../../types';
import { buildPlan } from '../args';
import { parseProbe } from '../probe';
import { parseLoudnorm } from '../args';

export interface EngineOutput {
  bytes: Uint8Array;
  ext: string;
  mime: string;
  badges: string[];
}

export type ProgressFn = (p: number, phase: 'analyze' | 'encode') => void;

const LOG_RING = 400;

export class FFmpegEngine {
  private ff: FFmpeg | null = null;
  private loading: Promise<void> | null = null;
  private capture: string[] | null = null;
  private progressFn: ProgressFn | null = null;
  private phase: 'analyze' | 'encode' = 'encode';
  private cancelled = false;

  soxr = false;
  logs: string[] = [];
  onLog: ((line: string) => void) | null = null;

  /** All FS+exec work funnels through one queue — the wasm core is a single
   *  instance and log capture is positional, so overlap is never safe. */
  private opQueue: Promise<unknown> = Promise.resolve();
  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.opQueue.then(fn, fn);
    this.opQueue = run.catch(() => {});
    return run;
  }

  private pushLog(line: string) {
    this.logs.push(line);
    if (this.logs.length > LOG_RING) this.logs.splice(0, this.logs.length - LOG_RING);
    this.capture?.push(line);
    this.onLog?.(line);
  }

  async load(): Promise<void> {
    if (this.ff) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const ff = new FFmpeg();
      ff.on('log', ({ message }) => this.pushLog(message));
      ff.on('progress', ({ progress }) => {
        if (this.progressFn && Number.isFinite(progress)) {
          this.progressFn(Math.min(1, Math.max(0, progress)), this.phase);
        }
      });
      await ff.load({ coreURL, wasmURL });
      this.ff = ff;
      // sniff the build config for libsoxr so the arg builder can go gold-plated
      const cfg = await this.withCapture(() => ff.exec(['-hide_banner', '-version']));
      this.soxr = cfg.logs.some((l) => l.includes('--enable-libsoxr'));
    })();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  get ready(): boolean {
    return this.ff !== null;
  }

  private async withCapture<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string[] }> {
    const buf: string[] = [];
    this.capture = buf;
    try {
      const result = await fn();
      return { result, logs: buf };
    } finally {
      this.capture = null;
    }
  }

  private fs(): FFmpeg {
    if (!this.ff) throw new Error('DSP core not loaded');
    return this.ff;
  }

  /** A wasm-level fault leaves the core unusable — scrap it so the next op reloads fresh. */
  private noteFatal(e: unknown): void {
    if (/memory access|out of bounds|RuntimeError|Aborted|unreachable|table index/i.test(String(e))) {
      const ff = this.ff;
      this.ff = null;
      if (ff) {
        try { ff.terminate(); } catch { /* already dead */ }
      }
      this.pushLog('DSP CORE FAULT — RELOADING FRESH CORE');
    }
  }

  private async cleanup(names: string[]) {
    const ff = this.ff;
    if (!ff) return; // core faulted; fresh core has an empty FS anyway
    for (const n of names) {
      try { await ff.deleteFile(n); } catch { /* already gone */ }
    }
  }

  probe(file: File): Promise<ProbeInfo> {
    return this.serialize(() => this.probeInner(file));
  }

  private async probeInner(file: File): Promise<ProbeInfo> {
    await this.load();
    const ff = this.fs();
    const name = `probe.${extOf(file.name)}`;
    await ff.writeFile(name, new Uint8Array(await file.arrayBuffer()));
    try {
      // exits non-zero by design (no output file) — we only want the stderr
      const { logs } = await this.withCapture(() => ff.exec(['-hide_banner', '-i', name]));
      const info = parseProbe(logs);
      if (!info.codec) throw new Error('NO AUDIO STREAM FOUND');
      return info;
    } catch (e) {
      this.noteFatal(e);
      throw e;
    } finally {
      await this.cleanup([name]).catch(() => {});
    }
  }

  convert(
    file: File,
    preset: Preset,
    probe: ProbeInfo | undefined,
    onProgress: ProgressFn,
  ): Promise<EngineOutput> {
    return this.serialize(() => this.convertInner(file, preset, probe, onProgress));
  }

  private async convertInner(
    file: File,
    preset: Preset,
    probe: ProbeInfo | undefined,
    onProgress: ProgressFn,
  ): Promise<EngineOutput> {
    await this.load();
    const ff = this.fs();
    this.cancelled = false;

    const inputName = `in.${extOf(file.name)}`;
    const plan = buildPlan(preset, probe, { inputName, soxr: this.soxr });

    await ff.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
    this.progressFn = onProgress;

    try {
      return await this.runPlanned(ff, plan);
    } catch (e) {
      this.noteFatal(e);
      throw e;
    } finally {
      this.progressFn = null;
      await this.cleanup([inputName, plan.outputName]).catch(() => {});
    }
  }

  private async runPlanned(
    ff: FFmpeg,
    plan: ReturnType<typeof buildPlan>,
  ): Promise<EngineOutput> {
    let measured: LoudnormMeasured | null = null;
    if (plan.measureArgs) {
      this.phase = 'analyze';
      const { result, logs } = await this.withCapture(() => ff.exec(plan.measureArgs!));
      this.throwIfCancelled();
      if (result !== 0) throw new Error(tail(logs) || 'LOUDNESS ANALYSIS FAILED');
      measured = parseLoudnorm(logs);
      // dead silence → normalizing would blow up gain; run flat instead
      if (measured && measured.input_i < -70) measured = null;
    }

    this.phase = 'encode';
    let run = await this.withCapture(() => ff.exec(plan.mainArgs(measured)));
    this.throwIfCancelled();
    if (run.result !== 0 && plan.withArt) {
      // odd embedded art can refuse to mux — retry once without it
      run = await this.withCapture(() => ff.exec(plan.mainArgsNoArt(measured)));
      this.throwIfCancelled();
    }
    if (run.result !== 0) throw new Error(tail(run.logs) || 'CONVERSION FAILED');

    const data = await ff.readFile(plan.outputName);
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
    if (bytes.length === 0) throw new Error('EMPTY OUTPUT');
    return {
      bytes,
      ext: plan.format.ext,
      mime: plan.format.mime,
      badges: plan.badges,
    };
  }

  private throwIfCancelled() {
    if (this.cancelled) throw new Error('CANCELLED');
  }

  get wasCancelled(): boolean {
    return this.cancelled;
  }

  /** Hard-stop the running job. The worker is killed; the core reloads lazily. */
  async cancel(): Promise<void> {
    this.cancelled = true;
    const ff = this.ff;
    this.ff = null;
    this.progressFn = null;
    if (ff) {
      try { ff.terminate(); } catch { /* worker already dead */ }
    }
  }

  /** Dry-run plan for LCD display (badges, effective values). */
  plan(preset: Preset, probe: ProbeInfo | undefined) {
    return buildPlan(preset, probe, { inputName: 'in', soxr: this.soxr });
  }
}

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  return m ? m[1] : 'bin';
}

function tail(logs: string[]): string {
  const interesting = logs.filter((l) => /error|invalid|fail|denied|unsupported|no such/i.test(l));
  const pick = interesting.length ? interesting : logs;
  return pick.slice(-3).join(' · ').slice(0, 300);
}

export const engine = new FFmpegEngine();
