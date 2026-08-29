#!/usr/bin/env node
// Simulate GitHub Pages: serve dist/ under a /ConverT/ subpath with plain
// static-file semantics (no COOP/COEP, Pages-style redirect), then boot the
// app there and push one real conversion through the DSP. Guards the
// `base: './'` config — a regression here means a blank page on Pages.

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 4610;
const PREFIX = '/ConverT';
const URL = `http://localhost:${PORT}${PREFIX}/`;
const DIST = 'dist';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (path === PREFIX) { // Pages redirects /ConverT → /ConverT/
    res.writeHead(301, { location: `${PREFIX}/` });
    res.end();
    return;
  }
  if (!path.startsWith(`${PREFIX}/`)) {
    res.writeHead(404);
    res.end('not under prefix');
    return;
  }
  let rel = path.slice(PREFIX.length + 1) || 'index.html';
  let file = join(DIST, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end('nope');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

function sineWav() {
  const rate = 44100, frames = rate * 2, ba = 4;
  const buf = Buffer.alloc(44 + frames * ba);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + frames * ba, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * ba, 28);
  buf.writeUInt16LE(ba, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36);
  buf.writeUInt32LE(frames * ba, 40);
  for (let i = 0; i < frames; i++) {
    const v = Math.round(11000 * Math.sin(2 * Math.PI * 440 * i / rate));
    buf.writeInt16LE(v, 44 + i * 4); buf.writeInt16LE(v, 46 + i * 4);
  }
  return buf;
}

const wav = join('scripts/.artifacts', 'pages-tone.wav');
writeFileSync(wav, sineWav());

let browser;
let ok = false;
try {
  await new Promise((resolve) => server.listen(PORT, resolve));
  const exe = existsSync('/opt/pw-browsers/chromium') && statSync('/opt/pw-browsers/chromium').isFile()
    ? '/opt/pw-browsers/chromium' : undefined;
  browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`REQ FAIL ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });

  // no trailing slash — must survive the Pages-style redirect
  await page.goto(`http://localhost:${PORT}${PREFIX}`);
  await page.waitForFunction(
    () => window.__ct?.useCt.getState().engineState === 'ready',
    null,
    { timeout: 120000 },
  );
  console.log('✓ app booted under /ConverT/ subpath (JS, worker, wasm, fonts all resolved)');

  await page.setInputFiles('input[type=file]', [wav]);
  await page.waitForFunction(() => {
    const fs = window.__ct.useCt.getState().files;
    return fs.length === 1 && fs[0].status === 'ready';
  }, null, { timeout: 45000 });

  const res = await page.evaluate(async () => {
    window.__ct.setFormat('mp3');
    await window.__ct.startBatch();
    const f = window.__ct.useCt.getState().files[0];
    return { status: f.status, size: f.result?.size ?? 0, err: f.error ?? null };
  });
  if (res.status !== 'done' || res.size <= 0) throw new Error(`convert failed: ${JSON.stringify(res)}`);
  console.log(`✓ converted under subpath (mp3, ${res.size}B)`);

  const fatal = errors.filter((e) => !e.includes('favicon'));
  if (fatal.length) throw new Error(`page errors: ${fatal.slice(0, 5).join(' | ')}`);
  ok = true;
  console.log('✅ PAGES SMOKE PASSED');
} catch (e) {
  console.error('❌ PAGES SMOKE FAILED:', String(e).slice(0, 500));
} finally {
  await Promise.race([browser?.close().catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
  server.close();
  setTimeout(() => process.exit(ok ? 0 : 1), 200).unref();
}
