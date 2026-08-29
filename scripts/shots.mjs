#!/usr/bin/env node
// Capture the CT-505 in its natural habitats: idle, loaded, converting, done, tripping.

import { spawn } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 4604;
const URL = `http://localhost:${PORT}/`;
const ART = 'scripts/.artifacts';

function sineWav(rate, bits, seconds) {
  const ch = 2, frames = rate * seconds, bp = bits / 8, ba = ch * bp;
  const buf = Buffer.alloc(44 + frames * ba);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + frames * ba, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * ba, 28);
  buf.writeUInt16LE(ba, 32); buf.writeUInt16LE(bits, 34); buf.write('data', 36);
  buf.writeUInt32LE(frames * ba, 40);
  const amp = 0.4 * (2 ** (bits - 1) - 1);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    const v = Math.round(amp * Math.sin(2 * Math.PI * (330 + 110 * Math.sin(i / rate)) * i / rate));
    for (let c = 0; c < ch; c++) {
      if (bits === 16) { buf.writeInt16LE(v, o); o += 2; }
      else { buf.writeUInt8(v & 0xff, o); buf.writeUInt8((v >> 8) & 0xff, o + 1); buf.writeUInt8((v >> 16) & 0xff, o + 2); o += 3; }
    }
  }
  return buf;
}

const files = [
  ['dream-machine-909.wav', sineWav(44100, 16, 2)],
  ['acid-bassline-303.wav', sineWav(48000, 16, 2)],
  ['cosmic-jam-96k.wav', sineWav(96000, 24, 30)],
  ['liquid-groove.wav', sineWav(44100, 16, 3)],
];
for (const [n, b] of files) writeFileSync(join(ART, n), b);

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const exe = existsSync('/opt/pw-browsers/chromium') && statSync('/opt/pw-browsers/chromium').isFile()
  ? '/opt/pw-browsers/chromium' : undefined;

let browser;
try {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(URL)).ok) break; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1060 } });
  await page.goto(URL);
  await page.waitForFunction(() => window.__ct?.useCt.getState().engineState === 'ready', null, { timeout: 120000 });
  await page.screenshot({ path: join(ART, 'shot-idle.png') });

  await page.setInputFiles('input[type=file]', files.map(([n]) => join(ART, n)));
  await page.waitForFunction(() => {
    const fs = window.__ct.useCt.getState().files;
    return fs.length === 4 && fs.every((f) => f.status === 'ready');
  }, null, { timeout: 60000 });
  await page.screenshot({ path: join(ART, 'shot-loaded.png') });

  // FLAC CD patch (dither+resample, slowest path) and catch it mid-flight on the big file
  await page.evaluate(() => {
    window.__ct.setFormat('flac');
    window.__ct.setEdit({ quality: 'c8', rate: 44100, depth: 16, dither: 'shibata', norm: 'off', gainDb: 0 });
    void window.__ct.startBatch();
  });
  await page.waitForFunction(() => {
    const f = window.__ct.useCt.getState().files.find((x) => x.status === 'converting');
    return f && f.name.includes('cosmic') && f.progress > 0.15 && f.progress < 0.97;
  }, null, { timeout: 120000 });
  await page.screenshot({ path: join(ART, 'shot-converting.png') });

  await page.waitForFunction(() => {
    const s = window.__ct.useCt.getState();
    return !s.running && s.files.every((f) => f.status === 'done');
  }, null, { timeout: 240000 });
  await page.screenshot({ path: join(ART, 'shot-done.png') });

  await page.evaluate(() => document.querySelector('.trip-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(ART, 'shot-trip.png') });
  console.log('shots saved');
} catch (e) {
  console.error('shots crashed:', String(e).slice(0, 300));
  process.exitCode = 1;
} finally {
  await Promise.race([browser?.close().catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
  preview.kill('SIGKILL');
  setTimeout(() => process.exit(process.exitCode ?? 0), 200).unref();
}
