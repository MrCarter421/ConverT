// ─── ConverT CT-505 · UI sound synth ─────────────────────────────────────────
// Tiny WebAudio blips so the hardware clicks like hardware. All synthesized,
// no samples. Master gain is deliberately shy.

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(
  freq: number,
  dur: number,
  type: OscillatorType = 'square',
  gain = 0.05,
  when = 0,
  slide = 0,
) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + when;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  click: () => blip(1400, 0.03, 'square', 0.035),
  tick: () => blip(2100, 0.012, 'square', 0.022),
  pad: () => blip(320, 0.06, 'sine', 0.06, 0, -80),
  start: () => {
    blip(220, 0.08, 'sawtooth', 0.04);
    blip(440, 0.1, 'square', 0.035, 0.07);
  },
  done: () => {
    // little acid arp on batch completion
    blip(659, 0.09, 'triangle', 0.05, 0);
    blip(880, 0.09, 'triangle', 0.05, 0.09);
    blip(1319, 0.22, 'triangle', 0.05, 0.18);
  },
  error: () => blip(110, 0.25, 'sawtooth', 0.06, 0, -40),
};
