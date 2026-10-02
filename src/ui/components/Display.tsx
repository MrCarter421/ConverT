// The display: a Winamp main-window readout behind Aero smoked glass.
// Big digits, scrolling marquee, kbps/khz boxes, mono/stereo lamps, a little
// analyzer and the quality badges for the file in focus.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { runProgress, useCt } from '../../state/store';
import { FORMATS, qualityOf } from '../../audio/formats';
import { engine } from '../../audio/engine/ffmpegEngine';
import { fmtDur, fmtRate } from '../../util/fmt';
import type { FileEntry } from '../../types';
import { IconCheck, IconEject, IconPlay, IconStop } from './Icons';

function Marquee({ text }: { text: string }) {
  const box = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [scroll, setScroll] = useState(false);
  useLayoutEffect(() => {
    const b = box.current;
    const p = probe.current;
    if (b && p) setScroll(p.scrollWidth > b.clientWidth + 2);
  }, [text]);
  return (
    <div className="lcd-marquee" ref={box} title={text}>
      <span ref={probe} className="marquee-measure" aria-hidden>{text}</span>
      {scroll ? (
        <span className="marquee-run" style={{ animationDuration: `${Math.max(7, text.length * 0.22)}s` }}>
          <span>{text}&nbsp;&nbsp;***&nbsp;&nbsp;</span>
          <span aria-hidden>{text}&nbsp;&nbsp;***&nbsp;&nbsp;</span>
        </span>
      ) : (
        <span className="marquee-static">{text}</span>
      )}
    </div>
  );
}

const BARS = 18;
// a calm pink-noise slope for the idle analyzer
const IDLE = Array.from({ length: BARS }, (_, i) => 0.42 - i * 0.017 + (i % 3 === 1 ? 0.04 : 0));

function Analyzer({ active, loaded, still }: { active: boolean; loaded: boolean; still: boolean }) {
  const [bars, setBars] = useState<number[]>(IDLE);
  useEffect(() => {
    if (!active || still) {
      setBars(IDLE);
      return;
    }
    let t = 0;
    const iv = setInterval(() => {
      t += 1;
      setBars((prev) => prev.map((v, i) => {
        const tilt = 1 - i / (BARS * 1.4);
        const target = (0.2 + 0.8 * Math.abs(Math.sin(t * 0.31 + i * 0.77)) * (0.55 + Math.random() * 0.45)) * tilt;
        return v + (target - v) * 0.5;
      }));
    }, 85);
    return () => clearInterval(iv);
  }, [active, still]);
  return (
    <div className={`lcd-analyzer ${loaded || active ? '' : 'is-empty'}`} aria-hidden>
      {bars.map((b, i) => (
        <i key={i} style={{ height: `${Math.max(6, Math.round(b * 100))}%` }} />
      ))}
    </div>
  );
}

function focusFile(files: FileEntry[], selectedId: string | null): FileEntry | undefined {
  return files.find((f) => f.status === 'converting')
    ?? files.find((f) => f.id === selectedId)
    ?? files[0];
}

const rateNum = (hz: number) => fmtRate(hz).replace('K', '');

export function Display() {
  const s = useCt();
  const booting = s.engineState !== 'ready';
  const f = focusFile(s.files, s.selectedId);
  const fmt = FORMATS[s.edit.format];
  const qv = qualityOf(fmt, s.edit.quality);
  const plan = f ? engine.plan(s.edit, f.probe) : null;
  const converting = s.files.find((x) => x.status === 'converting');
  const allDone = s.files.length > 0 && s.files.every((x) => x.status === 'done');

  // ── big digits ──
  let digits: string;
  if (booting) digits = '--:--';
  else if (s.running) digits = `${String(Math.round(runProgress(s) * 100)).padStart(3, ' ')}%`;
  else if (s.files.length) digits = fmtDur(s.files.reduce((t, x) => t + (x.probe?.durationSec ?? 0), 0));
  else digits = '00:00';

  // ── marquee ──
  let text: string;
  if (s.toast) text = s.toast;
  else if (booting) text = s.engineState === 'error' ? `${s.engineMsg} · RELOAD TO RETRY` : `${s.engineMsg}…`;
  else if (s.running && converting) {
    const n = s.runIds.indexOf(converting.id) + 1;
    text = `${n}/${s.runIds.length} ${converting.phase === 'analyze' ? 'MEASURING LOUDNESS' : 'CONVERTING'} · ${converting.name} → ${fmt.knob} ${qv.knob}`;
  } else if (f) {
    const idx = s.files.indexOf(f) + 1;
    const tags = [f.probe?.tags.artist, f.probe?.tags.title].filter(Boolean).join(' - ');
    const dur = f.probe?.durationSec ? ` (${fmtDur(f.probe.durationSec)})` : '';
    text = `${idx}. ${tags || f.name}${dur}`;
    if (f.status === 'probing') text = `${idx}. ${f.name} · READING…`;
    if (f.status === 'error') text = `${idx}. ${f.name} · ${f.error ?? 'FAILED'}`;
  } else {
    text = 'CONVERT · DROP AUDIO FILES TO BEGIN · ANY FORMAT IN · AUDIOPHILE GRADE OUT · NOTHING LEAVES THIS COMPUTER';
  }

  // ── readouts (what the output will be) ──
  const box1 = fmt.lossless
    ? {
        v: plan?.effective.depth
          ? String(plan.effective.depth)
          : s.edit.depth === 'keep' ? 'src' : String(s.edit.depth),
        u: 'bit',
      }
    : { v: qv.knob, u: /^\d+$/.test(qv.knob) ? 'kbps' : qv.knob.startsWith('V') ? 'vbr' : 'qual' };
  const rate = plan ? rateNum(plan.effective.rate) : s.edit.rate === 'keep' ? 'src' : rateNum(s.edit.rate);
  const ch = plan ? plan.effective.channels : s.edit.channels === 'keep' ? null : s.edit.channels;

  const glyph = s.running
    ? <IconPlay size={13} className="lcd-blink" />
    : allDone ? <IconCheck size={14} />
    : s.files.length ? <IconStop size={12} />
    : <IconEject size={13} />;

  const badges = plan?.badges.filter((b) => b !== 'FLOAT64 DSP').slice(0, 3) ?? [];

  return (
    <div className="lcd" role="status" aria-live="polite" aria-label="Display">
      <div className="lcd-left">
        <div className="lcd-time">
          <span className={`lcd-glyph ${s.running ? 'is-hot' : ''}`}>{glyph}</span>
          <span className={`lcd-digits ${booting ? 'lcd-blink' : ''}`}>{digits}</span>
        </div>
        <Analyzer active={s.running} loaded={s.files.length > 0} still={!s.motion} />
      </div>
      <div className="lcd-right">
        <Marquee text={text.toUpperCase()} />
        <div className="lcd-readouts">
          <span className="lcd-fmt">{fmt.knob}</span>
          <span className="lcd-box"><b>{box1.v}</b>{box1.u}</span>
          <span className="lcd-box"><b>{rate}</b>khz</span>
          <span className="lcd-lamps">
            <i className={ch === 1 ? 'on' : ''}>mono</i>
            <i className={ch !== null && ch >= 2 ? 'on' : ''}>stereo</i>
          </span>
        </div>
        <div className="lcd-badges">
          {badges.length
            ? badges.map((b) => <span key={b} className={`lcd-badge ${b === 'BIT PERFECT' ? 'is-good' : b.endsWith('!') || b === 'LOSSY SRC' ? 'is-warn' : ''}`}>{b}</span>)
            : <span className="lcd-dim">{fmt.name}</span>}
        </div>
      </div>
      <div className="lcd-gloss" aria-hidden />
    </div>
  );
}
