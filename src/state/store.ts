// ─── ConverT CT-505 · state + batch runner ───────────────────────────────────

import { create } from 'zustand';
import type {
  EngineState, FileEntry, FormatId, LcdPage, Preset,
} from '../types';
import { FORMATS, qualityOf, ratesForFormat } from '../audio/formats';
import { DEFAULT_PRESET, FACTORY_PRESETS, autoName, newId, presetsEqual } from '../audio/presets';
import { engine } from '../audio/engine/ffmpegEngine';
import { sfx, setSoundEnabled } from '../ui/fx/sound';
import { baseName } from '../util/fmt';
import { downloadBlob, zipFiles } from '../util/files';

export const MAX_FILES = 64;
export const PADS_PER_BANK = 16;

const LS_PRESETS = 'convert.presets.v1';
const LS_SETTINGS = 'convert.settings.v1';
const LS_EDIT = 'convert.edit.v1';

interface Settings {
  sound: boolean;
  autoDl: boolean;
  trip: boolean;
}

export interface CtState {
  engineState: EngineState;
  engineMsg: string;
  soxr: boolean;
  files: FileEntry[];
  selectedId: string | null;
  bank: number;
  edit: Preset;
  presets: Preset[];
  presetIndex: number;
  running: boolean;
  stopFlag: boolean;
  lcdPage: LcdPage;
  trip: boolean;
  sound: boolean;
  autoDl: boolean;
  logs: string[];
  toast: string | null;
}

// ── persistence ──────────────────────────────────────────────────────────────

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full/blocked */ }
}

function loadPresets(): Preset[] {
  const user = loadJson<Preset[]>(LS_PRESETS) ?? [];
  const sane = user.filter((p) => p && p.id && p.format in FORMATS);
  return [...FACTORY_PRESETS, ...sane.map((p) => ({ ...DEFAULT_PRESET, ...p, factory: false }))];
}

function loadSettings(): Settings {
  return { sound: true, autoDl: false, trip: false, ...(loadJson<Partial<Settings>>(LS_SETTINGS) ?? {}) };
}

const bootSettings = loadSettings();
setSoundEnabled(bootSettings.sound);

// ── store ────────────────────────────────────────────────────────────────────

export const useCt = create<CtState>(() => ({
  engineState: 'boot',
  engineMsg: 'PRESS ANY KEY… JK. LOADING',
  soxr: false,
  files: [],
  selectedId: null,
  bank: 0,
  edit: { ...(loadJson<Preset>(LS_EDIT) ?? DEFAULT_PRESET), id: 'edit', factory: false },
  presets: loadPresets(),
  presetIndex: 0,
  running: false,
  stopFlag: false,
  lcdPage: 'file',
  ...bootSettings,
  logs: [],
  toast: null,
}));

const get = useCt.getState;
const set = useCt.setState;

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function flash(msg: string, ms = 2200) {
  set({ toast: msg });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => set({ toast: null }), ms);
}

function persistEdit() {
  const { edit } = get();
  saveJson(LS_EDIT, edit);
}
function persistPresets() {
  saveJson(LS_PRESETS, get().presets.filter((p) => !p.factory));
}
function persistSettings() {
  const { sound, autoDl, trip } = get();
  saveJson(LS_SETTINGS, { sound, autoDl, trip });
}

// ── engine boot ──────────────────────────────────────────────────────────────

let booted = false;
export async function bootEngine() {
  if (booted) return;
  booted = true;
  engine.onLog = (line) => {
    const logs = [...get().logs, line];
    if (logs.length > 120) logs.splice(0, logs.length - 120);
    set({ logs });
  };
  set({ engineState: 'loading', engineMsg: 'LOADING DSP CORE (WASM)…' });
  try {
    await engine.load();
    set({
      engineState: 'ready',
      soxr: engine.soxr,
      engineMsg: `DSP READY · ${engine.soxr ? 'SOXR' : 'SWR-HQ'} RESAMPLER`,
    });
    // probe anything dropped while booting
    for (const f of get().files.filter((x) => x.status === 'probing')) void probeEntry(f.id);
  } catch (e) {
    booted = false;
    set({ engineState: 'error', engineMsg: `DSP LOAD FAILED: ${String(e).slice(0, 80)}` });
  }
}

// ── files ────────────────────────────────────────────────────────────────────

function patchFile(id: string, patch: Partial<FileEntry>) {
  set({ files: get().files.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
}

async function probeEntry(id: string) {
  const entry = get().files.find((f) => f.id === id);
  if (!entry || !engine.ready) return;
  try {
    const probe = await engine.probe(entry.file);
    patchFile(id, { status: 'ready', probe });
  } catch (e) {
    patchFile(id, { status: 'error', error: String((e as Error).message ?? e).slice(0, 120) });
  }
}

export function addFiles(list: FileList | File[]) {
  const incoming = Array.from(list);
  if (!incoming.length) return;
  const room = MAX_FILES - get().files.length;
  if (room <= 0) {
    flash('BANKS FULL · 64 FILES MAX');
    sfx.error();
    return;
  }
  const taken = incoming.slice(0, room);
  if (taken.length < incoming.length) flash(`BANKS FULL · ${incoming.length - taken.length} SKIPPED`);
  const entries: FileEntry[] = taken.map((file) => ({
    id: newId('f'),
    file,
    name: file.name,
    size: file.size,
    status: 'probing',
    progress: 0,
  }));
  const files = [...get().files, ...entries];
  set({
    files,
    selectedId: get().selectedId ?? entries[0].id,
    lcdPage: 'file',
    bank: Math.floor((files.length - 1) / PADS_PER_BANK),
  });
  sfx.pad();
  if (engine.ready) entries.forEach((e) => void probeEntry(e.id));
}

export function removeFile(id: string) {
  const f = get().files.find((x) => x.id === id);
  if (!f || f.status === 'converting') return;
  if (f.result) URL.revokeObjectURL(f.result.url);
  const files = get().files.filter((x) => x.id !== id);
  set({
    files,
    selectedId: get().selectedId === id ? (files[0]?.id ?? null) : get().selectedId,
    bank: Math.min(get().bank, Math.max(0, Math.ceil(files.length / PADS_PER_BANK) - 1)),
  });
  sfx.click();
}

export function clearDone() {
  get().files.forEach((f) => { if (f.status === 'done' && f.result) URL.revokeObjectURL(f.result.url); });
  const files = get().files.filter((f) => f.status !== 'done');
  set({ files, selectedId: files[0]?.id ?? null, bank: 0 });
  flash('DONE SLOTS CLEARED');
}

export function clearAll() {
  if (get().running) return;
  get().files.forEach((f) => { if (f.result) URL.revokeObjectURL(f.result.url); });
  set({ files: [], selectedId: null, bank: 0 });
  flash('ALL BANKS CLEARED');
}

export function selectFile(id: string) {
  set({ selectedId: id, lcdPage: 'file' });
  sfx.click();
}

export function stepFile(dir: 1 | -1) {
  const { files, selectedId } = get();
  if (!files.length) return;
  const i = Math.max(0, files.findIndex((f) => f.id === selectedId));
  const next = files[(i + dir + files.length) % files.length];
  set({ selectedId: next.id, bank: Math.floor(files.indexOf(next) / PADS_PER_BANK) });
  sfx.tick();
}

export function setBank(bank: number) {
  set({ bank });
  sfx.click();
}

// ── preset editing (knobs write to the edit buffer, groovebox style) ─────────

export function setEdit(patch: Partial<Preset>) {
  const edit = { ...get().edit, ...patch };
  set({ edit });
  persistEdit();
  sfx.tick();
}

export function setFormat(format: FormatId) {
  const fmt = FORMATS[format];
  const edit = { ...get().edit, format };
  // reconcile knobs that the new format constrains
  edit.quality = qualityOf(fmt, edit.quality).id === edit.quality ? edit.quality : fmt.defaultQuality;
  if (!fmt.qualities.some((v) => v.id === edit.quality)) edit.quality = fmt.defaultQuality;
  if (edit.rate !== 'keep' && !ratesForFormat(fmt).includes(edit.rate)) edit.rate = 'keep';
  if (edit.depth !== 'keep' && (!fmt.depths || !fmt.depths.includes(edit.depth))) edit.depth = 'keep';
  set({ edit });
  persistEdit();
  sfx.tick();
}

export function editDirty(): boolean {
  const { edit, presets, presetIndex } = get();
  const loaded = presets[presetIndex];
  return !loaded || !presetsEqual(edit, loaded);
}

export function dialPreset(delta: number) {
  const { presets } = get();
  if (!presets.length) return;
  const index = ((get().presetIndex + delta) % presets.length + presets.length) % presets.length;
  loadPresetIndex(index);
}

export function loadPresetIndex(index: number) {
  const p = get().presets[index];
  if (!p) return;
  set({ presetIndex: index, edit: { ...p, id: 'edit', factory: false }, lcdPage: 'preset' });
  persistEdit();
  sfx.tick();
}

export function savePreset() {
  const { edit, presets } = get();
  const p: Preset = { ...edit, id: newId('u'), name: autoName(edit), factory: false };
  const next = [...presets, p];
  set({ presets: next, presetIndex: next.length - 1 });
  persistPresets();
  flash(`WROTE ${p.name}`);
  sfx.start();
}

export function deletePreset() {
  const { presets, presetIndex } = get();
  const p = presets[presetIndex];
  if (!p) return;
  if (p.factory) {
    flash('FACTORY PATCH · LOCKED');
    sfx.error();
    return;
  }
  const next = presets.filter((_, i) => i !== presetIndex);
  set({ presets: next, presetIndex: Math.min(presetIndex, next.length - 1) });
  persistPresets();
  flash(`DELETED ${p.name}`);
}

// ── system toggles ───────────────────────────────────────────────────────────

export function setPage(lcdPage: LcdPage) {
  set({ lcdPage });
  sfx.click();
}

export function toggleTrip() {
  set({ trip: !get().trip });
  persistSettings();
  sfx.start();
}

export function toggleSound() {
  const sound = !get().sound;
  set({ sound });
  setSoundEnabled(sound);
  persistSettings();
  if (sound) sfx.click();
}

export function toggleAutoDl() {
  set({ autoDl: !get().autoDl });
  persistSettings();
  sfx.click();
}

// ── batch runner ─────────────────────────────────────────────────────────────

export function presetSig(p: Preset): string {
  return JSON.stringify({ ...p, id: 0, name: 0, factory: 0 });
}

export async function startBatch() {
  const s = get();
  if (s.running || s.engineState !== 'ready') return;
  const sig = presetSig(s.edit);
  const queue = s.files.filter(
    (f) => f.status === 'ready' || f.status === 'error' ||
      (f.status === 'done' && f.result?.presetSig !== sig),
  );
  if (!queue.length) {
    flash(s.files.length ? 'ALL DONE · SAME PATCH' : 'LOAD FILES FIRST');
    sfx.error();
    return;
  }
  sfx.start();
  set({ running: true, stopFlag: false });
  queue.forEach((f) => patchFile(f.id, { status: 'queued', error: undefined, progress: 0 }));

  let hadError = false;
  for (const item of queue) {
    if (get().stopFlag) break;
    const entry = get().files.find((f) => f.id === item.id);
    if (!entry || entry.status !== 'queued') continue;

    if (entry.result) URL.revokeObjectURL(entry.result.url);
    patchFile(entry.id, { status: 'converting', progress: 0, phase: 'encode', result: undefined });
    set({ selectedId: entry.id, bank: Math.floor(get().files.findIndex((f) => f.id === entry.id) / PADS_PER_BANK) });

    const t0 = performance.now();
    try {
      const out = await engine.convert(
        entry.file,
        get().edit,
        entry.probe,
        (p, phase) => patchFile(entry.id, { progress: p, phase }),
      );
      const blob = new Blob([out.bytes as Uint8Array<ArrayBuffer>], { type: out.mime });
      const outName = `${baseName(entry.name)}.${out.ext}`;
      const result = {
        url: URL.createObjectURL(blob),
        size: blob.size,
        outName,
        mime: out.mime,
        badges: out.badges,
        elapsedMs: performance.now() - t0,
        presetSig: sig,
      };
      patchFile(entry.id, { status: 'done', progress: 1, result });
      if (get().autoDl) downloadBlob(result.url, outName);
    } catch (e) {
      if (engine.wasCancelled || get().stopFlag) {
        patchFile(entry.id, { status: 'ready', progress: 0 });
        break;
      }
      hadError = true;
      patchFile(entry.id, { status: 'error', error: String((e as Error).message ?? e).slice(0, 200), progress: 0 });
      sfx.error();
    }
  }

  // anything still queued (stopped early) returns to ready
  const wasStopped = get().stopFlag;
  get().files.forEach((f) => { if (f.status === 'queued') patchFile(f.id, { status: 'ready', progress: 0 }); });
  set({ running: false, stopFlag: false });

  if (!wasStopped) {
    const done = get().files.filter((f) => f.status === 'done').length;
    if (done > 0 && !hadError) sfx.done();
    flash(hadError ? 'BATCH DONE · WITH ERRORS' : done ? `BATCH DONE · ${done} FILES` : 'STOPPED');
  }
}

export async function stopBatch() {
  if (!get().running) return;
  set({ stopFlag: true });
  await engine.cancel();
  flash('STOPPED · DSP CORE RESET');
  sfx.error();
}

// ── downloads ────────────────────────────────────────────────────────────────

export function downloadOne(id: string) {
  const f = get().files.find((x) => x.id === id);
  if (f?.result) {
    downloadBlob(f.result.url, f.result.outName);
    sfx.click();
  }
}

export async function downloadAll() {
  const done = get().files.filter((f) => f.status === 'done' && f.result);
  if (!done.length) {
    flash('NOTHING TO DOWNLOAD');
    sfx.error();
    return;
  }
  sfx.click();
  if (done.length === 1) {
    downloadOne(done[0].id);
    return;
  }
  flash('PACKING ZIP…', 60000);
  try {
    const blob = await zipFiles(done.map((d) => ({ name: d.result!.outName, url: d.result!.url })));
    const url = URL.createObjectURL(blob);
    downloadBlob(url, `ConverT-batch-${new Date().toISOString().slice(0, 10)}.zip`);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    flash(`ZIPPED ${done.length} FILES`);
    sfx.done();
  } catch (e) {
    flash(`ZIP FAILED: ${String(e).slice(0, 40)}`);
    sfx.error();
  }
}

// expose for e2e tests + curious consoles
declare global {
  interface Window { __ct?: Record<string, unknown> }
}
if (typeof window !== 'undefined') {
  window.__ct = {
    useCt, addFiles, startBatch, stopBatch, setEdit, setFormat,
    loadPresetIndex, savePreset, downloadAll, engine, FORMATS,
  };
}
