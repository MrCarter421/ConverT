// ─── ConverT · state + batch runner ──────────────────────────────────────────

import { create } from 'zustand';
import type {
  EngineState, FileEntry, FormatId, Popup, Preset, Skin,
} from '../types';
import { FORMATS, qualityOf, ratesForFormat } from '../audio/formats';
import {
  DEFAULT_PRESET, FACTORY_PRESETS, autoName, dspFields, newId, presetsEqual,
} from '../audio/presets';
import { engine } from '../audio/engine/ffmpegEngine';
import { sfx, setSoundEnabled } from '../ui/fx/sound';
import { baseName } from '../util/fmt';
import { downloadBlob, zipFiles } from '../util/files';

export const MAX_FILES = 64;

const LS_PRESETS = 'convert.presets.v1';
const LS_SETTINGS = 'convert.settings.v2';
const LS_EDIT = 'convert.edit.v1';
const LS_CURRENT = 'convert.current.v1';

export interface Settings {
  sound: boolean;
  /** download results as soon as a batch finishes */
  autoDl: boolean;
  /** batches of 2+ files arrive as one zip instead of separate downloads */
  zipBatch: boolean;
  skin: Skin;
  /** animated background */
  motion: boolean;
}

export interface CtState extends Settings {
  engineState: EngineState;
  engineMsg: string;
  soxr: boolean;
  files: FileEntry[];
  selectedId: string | null;
  /** the working preset — what CONVERT uses */
  edit: Preset;
  presets: Preset[];
  /** library preset the edit buffer was loaded from (may since be modified) */
  presetId: string | null;
  running: boolean;
  stopFlag: boolean;
  /** files in the current / most recent batch */
  runIds: string[];
  popup: Popup;
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
  return [
    ...FACTORY_PRESETS,
    ...sane.map((p) => ({ ...DEFAULT_PRESET, ...p, factory: false, group: 'mine' as const })),
  ];
}

const reducedMotion = (() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
})();

function loadSettings(): Settings {
  return {
    sound: true,
    autoDl: true,
    zipBatch: true,
    skin: 'day',
    motion: !reducedMotion,
    ...(loadJson<Partial<Settings>>(LS_SETTINGS) ?? {}),
  };
}

/** the edit buffer survives reloads: you come back to the preset you left */
function loadEdit(): Preset {
  const saved = loadJson<Preset>(LS_EDIT);
  const base = saved && saved.format in FORMATS ? { ...DEFAULT_PRESET, ...saved } : DEFAULT_PRESET;
  return { ...base, id: 'edit', factory: false, group: undefined };
}

const bootSettings = loadSettings();
setSoundEnabled(bootSettings.sound);
// apply the skin before first paint — no flash of Aqua Day for Aurora Night users
try { document.documentElement.dataset.skin = bootSettings.skin; } catch { /* no DOM */ }
const bootPresets = loadPresets();
const bootEdit = loadEdit();
const bootPresetId = (() => {
  const saved = loadJson<string>(LS_CURRENT);
  if (saved && bootPresets.some((p) => p.id === saved)) return saved;
  // first run (or a deleted preset): adopt whichever library preset matches
  return bootPresets.find((p) => presetsEqual(p, bootEdit))?.id ?? null;
})();

// ── store ────────────────────────────────────────────────────────────────────

export const useCt = create<CtState>(() => ({
  engineState: 'boot',
  engineMsg: 'WARMING UP',
  soxr: false,
  files: [],
  selectedId: null,
  edit: bootEdit,
  presets: bootPresets,
  presetId: bootPresetId,
  running: false,
  stopFlag: false,
  runIds: [],
  popup: null,
  ...bootSettings,
  logs: [],
  toast: null,
}));

const get = useCt.getState;
const set = useCt.setState;

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function flash(msg: string, ms = 2600) {
  set({ toast: msg });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => set({ toast: null }), ms);
}

function persistEdit() {
  saveJson(LS_EDIT, get().edit);
  saveJson(LS_CURRENT, get().presetId);
}
function persistPresets() {
  saveJson(LS_PRESETS, get().presets.filter((p) => !p.factory));
}
function persistSettings() {
  const { sound, autoDl, zipBatch, skin, motion } = get();
  saveJson(LS_SETTINGS, { sound, autoDl, zipBatch, skin, motion });
}

// ── engine boot ──────────────────────────────────────────────────────────────

let booted = false;
export async function bootEngine() {
  if (booted) return;
  booted = true;
  engine.onLog = (line) => {
    const logs = [...get().logs, line];
    if (logs.length > 200) logs.splice(0, logs.length - 200);
    set({ logs });
  };
  set({ engineState: 'loading', engineMsg: 'LOADING DSP CORE' });
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
    flash(`QUEUE FULL · ${MAX_FILES} FILES MAX`);
    sfx.error();
    return;
  }
  const taken = incoming.slice(0, room);
  if (taken.length < incoming.length) flash(`QUEUE FULL · ${incoming.length - taken.length} SKIPPED`);
  const entries: FileEntry[] = taken.map((file) => ({
    id: newId('f'),
    file,
    name: file.name,
    size: file.size,
    status: 'probing',
    progress: 0,
  }));
  set({ files: [...get().files, ...entries] });
  sfx.pad();
  if (engine.ready) entries.forEach((e) => void probeEntry(e.id));
}

export function removeFile(id: string) {
  const f = get().files.find((x) => x.id === id);
  if (!f || f.status === 'converting' || f.status === 'queued') return;
  if (f.result) URL.revokeObjectURL(f.result.url);
  set({
    files: get().files.filter((x) => x.id !== id),
    selectedId: get().selectedId === id ? null : get().selectedId,
  });
  sfx.click();
}

export function clearAll() {
  if (get().running) return;
  get().files.forEach((f) => { if (f.result) URL.revokeObjectURL(f.result.url); });
  set({ files: [], selectedId: null, runIds: [] });
  sfx.click();
}

/** select a file to inspect; selecting it again closes the details */
export function toggleSelect(id: string) {
  set({ selectedId: get().selectedId === id ? null : id });
  sfx.tick();
}

// ── preset editing ───────────────────────────────────────────────────────────

export function setEdit(patch: Partial<Preset>) {
  set({ edit: { ...get().edit, ...patch } });
  persistEdit();
  sfx.tick();
}

export function setFormat(format: FormatId) {
  const fmt = FORMATS[format];
  const edit = { ...get().edit, format };
  // reconcile settings the new format constrains
  if (!fmt.qualities.some((v) => v.id === edit.quality)) edit.quality = fmt.defaultQuality;
  edit.quality = qualityOf(fmt, edit.quality).id;
  if (edit.rate !== 'keep' && !ratesForFormat(fmt).includes(edit.rate)) edit.rate = 'keep';
  if (edit.depth !== 'keep' && (!fmt.depths || !fmt.depths.includes(edit.depth))) edit.depth = 'keep';
  set({ edit });
  persistEdit();
  sfx.tick();
}

/** library preset the edit buffer came from, if any */
export function loadedPreset(s: Pick<CtState, 'presets' | 'presetId'> = get()): Preset | undefined {
  return s.presets.find((p) => p.id === s.presetId);
}

/** edit buffer differs from the library preset it was loaded from */
export function isModified(s: Pick<CtState, 'presets' | 'presetId' | 'edit'> = get()): boolean {
  const p = loadedPreset(s);
  return !p || !presetsEqual(p, s.edit);
}

export function loadPreset(id: string) {
  const p = get().presets.find((x) => x.id === id);
  if (!p) return;
  set({ presetId: id, edit: { ...p, id: 'edit', factory: false, group: undefined } });
  persistEdit();
  sfx.tick();
}

export function savePreset(name?: string) {
  const { edit, presets } = get();
  const clean = (name ?? '').trim().slice(0, 40) || autoName(edit);
  const p: Preset = { ...edit, id: newId('u'), name: clean, factory: false, group: 'mine' };
  set({ presets: [...presets, p], presetId: p.id, edit: { ...edit, name: clean } });
  persistPresets();
  persistEdit();
  flash(`SAVED PRESET · ${clean.toUpperCase()}`);
  sfx.start();
}

export function deletePreset(id: string) {
  const p = get().presets.find((x) => x.id === id);
  if (!p) return;
  if (p.factory) {
    flash('FACTORY PRESETS ARE LOCKED');
    sfx.error();
    return;
  }
  set({
    presets: get().presets.filter((x) => x.id !== id),
    presetId: get().presetId === id ? null : get().presetId,
  });
  persistPresets();
  persistEdit();
  flash(`DELETED · ${p.name.toUpperCase()}`);
  sfx.click();
}

// ── popups + settings ────────────────────────────────────────────────────────

export function openPopup(popup: Popup) {
  set({ popup });
  sfx.click();
}
export function closePopup() {
  if (get().popup) set({ popup: null });
}

export function setSettings(patch: Partial<Settings>) {
  set(patch);
  if (patch.sound !== undefined) setSoundEnabled(patch.sound);
  persistSettings();
  sfx.click();
}

// ── batch runner ─────────────────────────────────────────────────────────────

export function presetSig(p: Preset): string {
  return JSON.stringify(dspFields(p));
}

/** files the CONVERT button would run with the current preset */
export function pendingFiles(s: Pick<CtState, 'files' | 'edit'> = get()): FileEntry[] {
  const sig = presetSig(s.edit);
  return s.files.filter(
    (f) => f.status === 'ready' || f.status === 'error' ||
      (f.status === 'done' && f.result?.presetSig !== sig),
  );
}

/** 0..1 across the current / last batch */
export function runProgress(s: Pick<CtState, 'files' | 'runIds'> = get()): number {
  if (!s.runIds.length) return 0;
  let sum = 0;
  for (const id of s.runIds) {
    const f = s.files.find((x) => x.id === id);
    if (!f || f.status === 'done' || f.status === 'error') sum += 1;
    else if (f.status === 'converting') sum += f.progress;
  }
  return sum / s.runIds.length;
}

export async function startBatch() {
  const s = get();
  if (s.running || s.engineState !== 'ready') return;
  // snapshot: editing the preset mid-batch must not change files already queued
  const preset = s.edit;
  const sig = presetSig(preset);
  const queue = pendingFiles(s);
  if (!queue.length) {
    flash(s.files.length ? 'ALL DONE · SAME PRESET' : 'ADD SOME FILES FIRST');
    sfx.error();
    return;
  }
  sfx.start();
  set({ running: true, stopFlag: false, runIds: queue.map((f) => f.id) });
  queue.forEach((f) => patchFile(f.id, { status: 'queued', error: undefined, progress: 0 }));

  let hadError = false;
  const converted: string[] = [];
  for (const item of queue) {
    if (get().stopFlag) break;
    const entry = get().files.find((f) => f.id === item.id);
    if (!entry || entry.status !== 'queued') continue;

    if (entry.result) URL.revokeObjectURL(entry.result.url);
    patchFile(entry.id, { status: 'converting', progress: 0, phase: 'encode', result: undefined });

    const t0 = performance.now();
    try {
      const out = await engine.convert(
        entry.file,
        preset,
        entry.probe,
        (p, phase) => patchFile(entry.id, { progress: p, phase }),
      );
      const blob = new Blob([out.bytes as Uint8Array<ArrayBuffer>], { type: out.mime });
      const result = {
        url: URL.createObjectURL(blob),
        size: blob.size,
        outName: `${baseName(entry.name)}.${out.ext}`,
        mime: out.mime,
        badges: out.badges,
        elapsedMs: performance.now() - t0,
        presetSig: sig,
      };
      patchFile(entry.id, { status: 'done', progress: 1, result });
      converted.push(entry.id);
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
  if (wasStopped) return;

  if (converted.length && !hadError) sfx.done();
  flash(hadError
    ? `DONE WITH ERRORS · ${converted.length}/${queue.length} OK`
    : `DONE · ${converted.length} FILE${converted.length === 1 ? '' : 'S'} CONVERTED`);
  if (get().autoDl && converted.length) await deliver(converted);
}

export async function stopBatch() {
  if (!get().running) return;
  set({ stopFlag: true });
  await engine.cancel();
  flash('STOPPED');
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

/** hand results to the user: one file → itself, a batch → a zip (or each file) */
async function deliver(ids: string[]) {
  const done = ids
    .map((id) => get().files.find((f) => f.id === id))
    .filter((f): f is FileEntry => Boolean(f?.status === 'done' && f.result));
  if (!done.length) return;
  if (done.length === 1) {
    downloadOne(done[0].id);
    return;
  }
  if (!get().zipBatch) {
    // browsers throttle bursts of downloads — space them out
    for (const f of done) {
      downloadOne(f.id);
      await new Promise((r) => setTimeout(r, 350));
    }
    return;
  }
  flash('PACKING ZIP…', 60000);
  try {
    const blob = await zipFiles(done.map((d) => ({ name: d.result!.outName, url: d.result!.url })));
    const url = URL.createObjectURL(blob);
    const ext = done[0].result!.outName.split('.').pop() ?? 'audio';
    downloadBlob(url, `ConverT-${ext}-${new Date().toISOString().slice(0, 10)}.zip`);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    flash(`ZIPPED ${done.length} FILES`);
  } catch (e) {
    flash(`ZIP FAILED: ${String(e).slice(0, 40)}`);
    sfx.error();
  }
}

export async function downloadAll() {
  const done = get().files.filter((f) => f.status === 'done' && f.result);
  if (!done.length) {
    flash('NOTHING TO DOWNLOAD YET');
    sfx.error();
    return;
  }
  await deliver(done.map((f) => f.id));
}

// expose for e2e tests + curious consoles
declare global {
  interface Window { __ct?: Record<string, unknown> }
}
if (typeof window !== 'undefined') {
  window.__ct = {
    useCt, addFiles, startBatch, stopBatch, setEdit, setFormat,
    loadPreset, savePreset, deletePreset, downloadAll, setSettings, openPopup, closePopup,
    engine, FORMATS,
  };
}
