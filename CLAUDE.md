# ConverT — contributor notes

Browser-only batch audio converter (ffmpeg.wasm). UI is a single compact "media player"
window in a Frutiger Aero × Winamp-skin style: drop file → pick preset → press Convert →
it downloads. Everything else lives in pop-ups. React 19 + TypeScript + Vite + zustand.
No server, no network at runtime — everything (fonts, wasm core) is bundled.

## Commands

```bash
npm run dev        # vite dev server
npm run build      # tsc -b && vite build  (run before e2e/sweep)
npm run e2e        # headless-Chromium conversion tests + screenshots → scripts/.artifacts/
node scripts/sweep-formats.mjs   # every format must encode; run after touching formats.ts
node scripts/shots.mjs           # UI screenshots (idle/help/loaded/presets/converting/done/options/night/phone)
node scripts/pages-smoke.mjs     # serves dist/ under a /ConverT/ subpath like GitHub Pages
```

Deploys: `.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on
push. Vite `base` is `'./'` (relative) so the build works at any subpath — keep it that
way, and re-run `pages-smoke.mjs` after touching vite.config or asset/worker loading.

Chromium for scripts comes from `/opt/pw-browsers/chromium` (playwright-core, no download).

## Architecture map

- `src/audio/formats.ts` — declarative registry of target formats. **Adding a format is one
  entry here**; the preset window, display and arg builder derive everything from it.
- `src/audio/presets.ts` — factory library (`group` = shelf in the preset window),
  `presetTitle`/`presetDetail` plain-language descriptions, `dspFields` (what affects output).
- `src/audio/args.ts` — `buildPlan()`: probe + preset → ffmpeg args. All quality doctrine
  lives here (resampler settings, dither rules, R128 two-pass, badges). Change DSP behavior
  ONLY here so the e2e checks keep meaning something.
- `src/audio/probe.ts` — parses `ffmpeg -i` stderr (there is no ffprobe in the wasm build).
- `src/audio/engine/ffmpegEngine.ts` — the only file that knows about ffmpeg.wasm.
  Serializes every op through one queue (log capture is positional — never bypass it),
  auto-reloads the core after wasm faults (`noteFatal`).
- `src/state/store.ts` — zustand store, batch runner, delivery (1 file → file, batch → zip),
  localStorage persistence, popup state, `window.__ct` test hooks (e2e depends on these).
- `src/ui/Player.tsx` — the main window: Display, SeekBar, Playlist, PresetPill, ConvertButton.
  `src/ui/popups/` — Presets / Options / Help on a shared `Window` (Esc, backdrop, focus trap).
  `src/ui/filePicker.tsx` owns the ONE `<input type=file>` (tests target it).
- Styles: `styles/base.css` holds ALL tokens for both skins (`:root` = Aqua Day,
  `:root[data-skin='night']` = Aurora Night) + shared controls (gel, chips, selects, switch).
  Components read tokens only — a new skin is one token block.

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
  `z-index:-1` sky layer (CSS painting order).
- 24-bit output = `sample_fmt s32` + `-bits_per_raw_sample 24` (flac/alac/wavpack), or
  `pcm_s24le/be` for wav/aiff. Verified byte-level by e2e (FLAC STREAMINFO check).
- The probe input and convert input are written to the wasm FS per job and deleted after;
  memory is the constraint (single 2GB wasm heap), hence strictly sequential batches.

## Conventions

- **Never crowd the main window.** It holds display, file list, preset pill, convert button —
  new features go in a pop-up (usually *More options* in `PresetWindow.tsx` or Options).
- Factory presets are `factory: true` and never mutated; user presets persist to
  localStorage (`convert.presets.v1`, `group: 'mine'`). The preset window edits an *edit
  buffer* (`convert.edit.v1`) and the selected library id (`convert.current.v1`) — both
  restored on boot, so the app reopens on the preset you left. Settings: `convert.settings.v2`.
- `presetSig` (= `dspFields`) on results decides what re-queues when the preset changes;
  names/ids/groups must never be part of it.
- Sample-touching changes must extend `scripts/e2e.mjs` with a byte-level assertion.
  UI changes that alter the convert/download flow must keep the e2e "UI flow" block green.
- Copy voice: the display (VT323) speaks UPPERCASE ("QUEUE FULL · 64 FILES MAX"); everything
  else is friendly sentence case ("Drop audio files here").
