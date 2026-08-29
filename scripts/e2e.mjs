#!/usr/bin/env node
// ConverT CT-505 end-to-end test.
// Builds nothing itself — run `npm run build` first. Serves dist via `vite preview`,
// drives the app in headless Chromium, converts real audio through the wasm DSP,
// and byte-verifies the outputs.

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 4599;
const URL = `http://localhost:${PORT}/`;
const ART = process.env.E2E_ART_DIR || 'scripts/.artifacts';
mkdirSync(ART, { recursive: true });

const PROGRESS = join(ART, 'progress.log');
writeFileSync(PROGRESS, '');
function mark(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  appendFileSync(PROGRESS, line + '\n');
}

// hard watchdog — never hang the harness
const WATCHDOG = setTimeout(() => {
  mark('WATCHDOG: 10min exceeded, force exit');
  process.exit(2);
}, 10 * 60 * 1000);
WATCHDOG.unref?.();

// ── tiny WAV writer ──────────────────────────────────────────────────────────
function makeWav({ rate, bits, seconds, freqL = 440, freqR = 554.37 }) {
  const channels = 2;
  const frames = Math.round(rate * seconds);
  const bytesPer = bits / 8;
  const blockAlign = channels * bytesPer;
  const dataSize = frames * blockAlign;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * blockAlign, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bits, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  const amp = 0.4 * (2 ** (bits - 1) - 1);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    const t = i / rate;
    for (const f of [freqL, freqR]) {
      const v = Math.round(amp * Math.sin(2 * Math.PI * f * t));
      if (bits === 16) { buf.writeInt16LE(v, o); o += 2; }
      else { // 24-bit little-endian
        buf.writeUInt8(v & 0xff, o);
        buf.writeUInt8((v >> 8) & 0xff, o + 1);
        buf.writeUInt8((v >> 16) & 0xff, o + 2);
        o += 3;
      }
    }
  }
  return buf;
}

const wav44 = join(ART, 'tone-44k16.wav');
const wav96 = join(ART, 'tone-96k24.wav');
writeFileSync(wav44, makeWav({ rate: 44100, bits: 16, seconds: 2 }));
writeFileSync(wav96, makeWav({ rate: 96000, bits: 24, seconds: 2 }));

// ── chromium executable ──────────────────────────────────────────────────────
function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const flat = join(base, 'chromium');
  if (existsSync(flat) && statSync(flat).isFile()) return flat;
  for (const d of readdirSync(base)) {
    if (d.startsWith('chromium') && !d.includes('headless')) {
      for (const sub of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
        const p = join(base, d, sub);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

// ── preview server ───────────────────────────────────────────────────────────
function startPreview() {
  const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`));
  return child;
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(URL);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('preview server never came up');
}

// ── assertions ───────────────────────────────────────────────────────────────
let failures = 0;
function check(name, cond, detail = '') {
  const ok = Boolean(cond);
  console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const flacInfo = (bytes) => ({
  magic: String.fromCharCode(...bytes.slice(0, 4)),
  rate: (bytes[18] << 12) | (bytes[19] << 4) | (bytes[20] >> 4),
  channels: ((bytes[20] >> 1) & 0x07) + 1,
  bps: (((bytes[20] & 1) << 4) | (bytes[21] >> 4)) + 1,
});

// ── main ─────────────────────────────────────────────────────────────────────
const preview = startPreview();
mark("preview starting…");
let browser;
try {
  await waitForServer();
  const exe = findChromium();
  console.log(`chromium: ${exe ?? 'playwright default'}`);
  browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', (e) => mark(`[pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') mark(`[console.error] ${m.text().slice(0, 200)}`); });

  await page.goto(URL);
  mark('page loaded, waiting for DSP core…');
  await page.waitForFunction(
    () => window.__ct && window.__ct.useCt.getState().engineState === 'ready',
    null,
    { timeout: 120000 },
  );
  const soxr = await page.evaluate(() => window.__ct.engine.soxr);
  mark(`DSP ready · soxr available: ${soxr}`);

  await page.screenshot({ path: join(ART, 'ui-idle.png'), fullPage: true });

  // load files
  mark('adding files…');
  await page.setInputFiles('input[type=file]', [wav44, wav96]);
  await page.waitForFunction(
    () => {
      const fs = window.__ct.useCt.getState().files;
      return fs.length === 2 && fs.every((f) => f.status === 'ready' || f.status === 'error');
    },
    null,
    { timeout: 45000 },
  );
  mark('files probed');
  const probes = await page.evaluate(() =>
    window.__ct.useCt.getState().files.map((f) => ({
      name: f.name, rate: f.probe?.sampleRate, bits: f.probe?.bitDepth,
      ch: f.probe?.channels, dur: f.probe?.durationSec, codec: f.probe?.codec,
    })),
  );
  console.log('probes:', JSON.stringify(probes));
  check('probe 44k16 detected', probes.some((p) => p.rate === 44100 && p.bits === 16 && p.ch === 2));
  check('probe 96k24 detected', probes.some((p) => p.rate === 96000 && p.bits === 24 && p.ch === 2));
  check('probe duration ~2s', probes.every((p) => Math.abs((p.dur ?? 0) - 2) < 0.2));

  await page.screenshot({ path: join(ART, 'ui-loaded.png'), fullPage: true });

  const runBatch = async (label, setup) => {
    mark(`batch start: ${label}`);
    await page.evaluate(setup);
    await page.evaluate(() => window.__ct.startBatch());
    await page.waitForFunction(
      () => {
        const s = window.__ct.useCt.getState();
        return !s.running && s.files.every((f) => f.status === 'done' || f.status === 'error');
      },
      null,
      { timeout: 240000 },
    );
    const out = await page.evaluate(async () => {
      const s = window.__ct.useCt.getState();
      const res = [];
      for (const f of s.files) {
        if (f.status !== 'done' || !f.result) {
          res.push({ name: f.name, error: f.error ?? 'not done' });
          continue;
        }
        const buf = new Uint8Array(await (await fetch(f.result.url)).arrayBuffer());
        res.push({
          name: f.name,
          outName: f.result.outName,
          size: f.result.size,
          badges: f.result.badges,
          head: Array.from(buf.slice(0, 32)),
        });
      }
      return res;
    });
    console.log(`\n■ batch ${label}`);
    for (const r of out) {
      console.log(`  ${r.name} → ${r.outName ?? '??'} ${r.size ?? ''}B ${r.badges ? JSON.stringify(r.badges) : r.error}`);
    }
    check(`${label}: all files converted`, out.every((r) => !r.error && r.size > 0));
    return out;
  };

  // 1 · FLAC KEEP — bit-perfect path, 24-bit flac
  let out = await runBatch('FLAC KEEP', () => {
    window.__ct.setFormat('flac');
    window.__ct.setEdit({ quality: 'c8', rate: 'keep', depth: 'keep', channels: 'keep', dither: 'auto', norm: 'off', gainDb: 0 });
  });
  for (const r of out) {
    if (r.error) continue;
    const fi = flacInfo(r.head);
    const src96 = r.name.includes('96k24');
    check(`flac magic (${r.name})`, fi.magic === 'fLaC', fi.magic);
    check(`flac rate kept (${r.name})`, fi.rate === (src96 ? 96000 : 44100), String(fi.rate));
    check(`flac depth kept (${r.name})`, fi.bps === (src96 ? 24 : 16), String(fi.bps));
    if (!src96) check('bit-perfect badge', r.badges.includes('BIT PERFECT'), JSON.stringify(r.badges));
  }

  // 2 · FLAC CD 16/44.1 — resample + shibata dither
  out = await runBatch('FLAC CD 16/44.1', () => {
    window.__ct.setEdit({ rate: 44100, depth: 16, dither: 'shibata' });
  });
  for (const r of out) {
    if (r.error) continue;
    const fi = flacInfo(r.head);
    check(`flac 44.1/16 (${r.name})`, fi.rate === 44100 && fi.bps === 16 && fi.channels === 2, JSON.stringify(fi));
  }
  const badge96 = out.find((r) => r.name.includes('96k24'))?.badges ?? [];
  check('resample badge on 96k source', badge96.some((b) => b.includes('SWR') || b.includes('SOXR')), JSON.stringify(badge96));
  check('dither badge on 96k source', badge96.some((b) => b.includes('DITHER')), JSON.stringify(badge96));

  // 3 · MP3 320 CBR
  out = await runBatch('MP3 320', () => {
    window.__ct.setFormat('mp3');
    window.__ct.setEdit({ quality: 'cbr320', rate: 'keep', depth: 'keep', dither: 'auto' });
  });
  for (const r of out) {
    if (r.error) continue;
    const isMp3 = (r.head[0] === 0x49 && r.head[1] === 0x44 && r.head[2] === 0x33) // ID3
      || (r.head[0] === 0xff && (r.head[1] & 0xe0) === 0xe0); // MPEG sync
    check(`mp3 magic (${r.name})`, isMp3, r.head.slice(0, 3).join(','));
  }

  // 4 · OPUS 192 — 96k source must coerce to 48k
  out = await runBatch('OPUS 192', () => {
    window.__ct.setFormat('opus');
    window.__ct.setEdit({ quality: 'b192' });
  });
  for (const r of out) {
    if (r.error) continue;
    check(`ogg magic (${r.name})`, String.fromCharCode(...r.head.slice(0, 4)) === 'OggS');
  }

  // 5 · WAV 24/48 with R128 two-pass loudnorm (heaviest path)
  out = await runBatch('WAV 24/48 R128 -16', () => {
    window.__ct.setFormat('wav');
    window.__ct.setEdit({ rate: 48000, depth: 24, norm: -16 });
  });
  for (const r of out) {
    if (r.error) continue;
    const riff = String.fromCharCode(...r.head.slice(0, 4));
    const wave = String.fromCharCode(...r.head.slice(8, 12));
    check(`wav magic (${r.name})`, riff === 'RIFF' && wave === 'WAVE', `${riff}/${wave}`);
    check(`r128 badge (${r.name})`, r.badges.some((b) => b.includes('R128')), JSON.stringify(r.badges));
  }

  // trip mode screenshot for the vibes archive
  await page.evaluate(() => window.__ct.useCt.getState().trip || document.querySelector('.trip-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(ART, 'ui-trip.png'), fullPage: true });

  mark(`${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`);
  process.exitCode = failures === 0 ? 0 : 1;
} catch (e) {
  mark(`E2E crashed: ${String(e && e.message ? e.message : e).slice(0, 300)}`);
  process.exitCode = 1;
} finally {
  // browser.close() can hang in this container — never let cleanup wedge the run
  await Promise.race([
    browser?.close().catch(() => {}),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  preview.kill('SIGKILL');
  setTimeout(() => process.exit(process.exitCode ?? 0), 300).unref();
}
