// ─── ConverT · UI sound synth ────────────────────────────────────────────────
// Tiny WebAudio bubbles and chimes. All synthesized, no samples.
// Master gain is deliberately shy.

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
  click: () => blip(1250, 0.05, 'sine', 0.03, 0, 500),
  tick: () => blip(1800, 0.025, 'sine', 0.018),
  // water-drop: fast upward sine sweep
  pad: () => {
    blip(420, 0.09, 'sine', 0.05, 0, 900);
    blip(880, 0.06, 'sine', 0.025, 0.05, 600);
  },
  start: () => {
    blip(523, 0.12, 'sine', 0.04);
    blip(784, 0.16, 'sine', 0.035, 0.07);
  },
  done: () => {
    // glassy major-seventh chime on batch completion
    blip(784, 0.35, 'sine', 0.04, 0);
    blip(988, 0.35, 'sine', 0.035, 0.08);
    blip(1175, 0.4, 'sine', 0.032, 0.16);
    blip(1480, 0.6, 'triangle', 0.02, 0.24);
  },
  error: () => blip(240, 0.22, 'triangle', 0.05, 0, -90),
};
