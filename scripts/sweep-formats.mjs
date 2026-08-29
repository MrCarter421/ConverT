#!/usr/bin/env node
// Convert one 44.1k/16 WAV into EVERY registered format — no knob position
// may ship broken. Assumes `npm run build` was run.

import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 4602;
const URL = `http://localhost:${PORT}/`;
const wav44 = join('scripts/.artifacts', 'tone-44k16.wav');

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const exe = existsSync('/opt/pw-browsers/chromium') && statSync('/opt/pw-browsers/chromium').isFile()
  ? '/opt/pw-browsers/chromium' : undefined;

let browser;
let bad = 0;
try {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(URL)).ok) break; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.goto(URL);
  await page.waitForFunction(() => window.__ct?.useCt.getState().engineState === 'ready', null, { timeout: 120000 });
  await page.setInputFiles('input[type=file]', [wav44]);
  await page.waitForFunction(() => {
    const fs = window.__ct.useCt.getState().files;
    return fs.length === 1 && fs[0].status === 'ready';
  });

  const formats = await page.evaluate(() => Object.keys(window.__ct.FORMATS));
  for (const id of formats) {
    const res = await page.evaluate(async (fid) => {
      const { setFormat, startBatch, useCt, engine } = window.__ct;
      setFormat(fid);
      await startBatch();
      const f = useCt.getState().files[0];
      const out = { status: f.status, err: f.error ?? null, size: f.result?.size ?? 0, outName: f.result?.outName ?? '', head: [] };
      if (f.result) {
        const buf = new Uint8Array(await (await fetch(f.result.url)).arrayBuffer());
        out.head = Array.from(buf.slice(0, 12));
      }
      if (f.status !== 'done') out.logs = engine.logs.slice(-8);
      return out;
    }, id);
    const magic = res.head.length ? String.fromCharCode(...res.head.filter((b) => b >= 32 && b < 127)) : '';
    console.log(`${res.status === 'done' && res.size > 0 ? '✓' : '✗'} ${id.padEnd(5)} → ${res.outName} ${res.size}B  [${magic.slice(0, 8)}] ${res.err ?? ''}`);
    if (res.status !== 'done') {
      bad++;
      for (const l of res.logs ?? []) console.log(`    | ${l}`);
    }
  }
  console.log(bad === 0 ? '\n✅ ALL FORMATS ENCODE' : `\n❌ ${bad} FORMAT(S) BROKEN`);
} catch (e) {
  bad++;
  console.error('sweep crashed:', String(e).slice(0, 400));
} finally {
  await Promise.race([browser?.close().catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
  preview.kill('SIGKILL');
  setTimeout(() => process.exit(bad ? 1 : 0), 200).unref();
}
