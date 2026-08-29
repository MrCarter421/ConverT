# ConverT CT-505 — contributor notes

Browser-only batch audio converter (ffmpeg.wasm) styled as a Roland MC-505-era groovebox.
React 19 + TypeScript + Vite + zustand. No server, no network at runtime — everything
(fonts, wasm core) is bundled.

## Commands

```bash
npm run dev        # vite dev server
npm run build      # tsc -b && vite build  (run before e2e/sweep)
npm run e2e        # headless-Chromium conversion tests + screenshots → scripts/.artifacts/
node scripts/sweep-formats.mjs   # every format must encode; run after touching formats.ts
node scripts/shots.mjs           # UI state screenshots (idle/loaded/converting/done/trip)
```

Chromium for scripts comes from `/opt/pw-browsers/chromium` (playwright-core, no download).

## Architecture map

- `src/audio/formats.ts` — declarative registry of target formats. **Adding a format is one
  entry here**; knobs, LCD, presets and the arg builder derive everything from it.
- `src/audio/args.ts` — `buildPlan()`: probe + preset → ffmpeg args. All quality doctrine
  lives here (resampler settings, dither rules, R128 two-pass, badges). Change DSP behavior
  ONLY here so the e2e checks keep meaning something.
- `src/audio/probe.ts` — parses `ffmpeg -i` stderr (there is no ffprobe in the wasm build).
- `src/audio/engine/ffmpegEngine.ts` — the only file that knows about ffmpeg.wasm.
  Serializes every op through one queue (log capture is positional — never bypass it),
  auto-reloads the core after wasm faults (`noteFatal`).
- `src/state/store.ts` — zustand store, batch runner, localStorage persistence,
  `window.__ct` test hooks (e2e depends on these).
- `src/ui/**` — faceplate components. Design tokens in `styles/base.css`.

## Hard-won facts (do not relearn these)

- **libopus encode is broken** in `@ffmpeg/core` 0.12.10 (frame submit → OOB crash). We ship
  FFmpeg's native `opus` encoder (`-strict -2`). Re-test with `sweep-formats.mjs` before
  swapping back.
- A wasm crash **poisons the whole core** (later runs OOM); `noteFatal` scraps and lazily
  reloads it. Keep that path intact.
- `aresample` needs `out_chlayout=` (NOT deprecated `out_channel_layout=`) whenever it sits
  behind `loudnorm`, or graph negotiation fails with "Cannot select channel layout".
- loudnorm measured values are scraped by regex from the log stream — the
  `[Parsed_loudnorm]` prefix is NOT reliably present per-line in wasm log events.
- `body` must keep `background: transparent`; a body background paints over the fixed
  `z-index:-1` psychedelic layer (CSS painting order).
- 24-bit output = `sample_fmt s32` + `-bits_per_raw_sample 24` (flac/alac/wavpack), or
  `pcm_s24le/be` for wav/aiff. Verified byte-level by e2e (FLAC STREAMINFO check).
- The probe input and convert input are written to the wasm FS per job and deleted after;
  memory is the constraint (single 2GB wasm heap), hence strictly sequential batches.

## Conventions

- Factory presets are `factory: true` and never mutated; user presets persist to
  localStorage (`convert.presets.v1`). The knob row edits an *edit buffer*, groovebox-style;
  `presetSig` on results decides what re-queues when the patch changes.
- Sample-touching changes must extend `scripts/e2e.mjs` with a byte-level assertion.
- UI copy is UPPERCASE-silkscreen voice ("BANKS FULL · 64 FILES MAX").
