// Quick guide + what the display badges mean.

import { closePopup } from '../../state/store';
import { Window } from './Window';

const BADGES: [string, string][] = [
  ['BIT PERFECT', 'Lossless in, lossless out, nothing processed — every sample identical.'],
  ['GEN LOSS!', 'Lossy to lossy: a second generation of compression. Use a lossless source if you have one.'],
  ['LOSSY SRC', 'Lossless target, lossy source — the file gets bigger, not better.'],
  ['SWR 256TAP / SOXR', 'Sample rate is changing, through a high-precision resampler.'],
  ['DITHER …', 'Noise-shaped dither, applied only when reducing to 16‑bit.'],
  ['R128 −xxLU', 'Two-pass EBU R128 loudness normalization is on.'],
];

export function HelpWindow() {
  return (
    <Window
      title="How it works"
      className="help-win"
      footer={<button type="button" className="gel gel-blue done-btn" onClick={closePopup}>Got it</button>}
    >
      <ol className="steps">
        <li><b>Drop</b> audio files on the window (or click to browse). Any format, even video.</li>
        <li><b>Pick a preset</b> — or open it and tap a format and a quality. It’s remembered next time.</li>
        <li><b>Press Convert.</b> Your file downloads when it’s done; batches arrive as one .zip.</li>
      </ol>

      <h2 className="dial-h">The gold cables</h2>
      <ul className="facts">
        <li>Samples are never touched unless your preset asks for it.</li>
        <li>Any processing runs in 64-bit float; resampling uses a 256-tap filter.</li>
        <li>MP3 is LAME at its maximum-effort setting. Tags and cover art come along.</li>
        <li>Nothing is uploaded — the converter runs inside this browser tab.</li>
      </ul>

      <h2 className="dial-h">Display badges</h2>
      <dl className="badge-key">
        {BADGES.map(([b, d]) => (
          <div key={b}><dt>{b}</dt><dd>{d}</dd></div>
        ))}
      </dl>

      <p className="help-keys">
        Keys: <kbd>Esc</kbd> closes a pop-up or stops a batch · <kbd>Del</kbd> removes the focused file ·
        double-click a preset to apply and close.
      </p>
    </Window>
  );
}
