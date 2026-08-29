// The green LCD. Backlit, pixel-gridded, and the center of truth.

import { useEffect, useMemo, useState } from 'react';
import type { CtState } from '../../state/store';
import {
  setPage, toggleAutoDl, toggleSound, toggleTrip, useCt,
} from '../../state/store';
import { FORMATS, qualityOf } from '../../audio/formats';
import { engine } from '../../audio/engine/ffmpegEngine';
import { fmtBytes, fmtChannels, fmtDepth, fmtDur, fmtRate } from '../../util/fmt';
import type { FileEntry, LcdPage } from '../../types';

function Marq({ text, max = 30 }: { text: string; max?: number }) {
  if (text.length <= max) return <span>{text}</span>;
  return (
    <span className="marq" style={{ animationDuration: `${Math.max(6, text.length * 0.28)}s` }}>
      {text}&nbsp;&nbsp;···&nbsp;&nbsp;{text}
    </span>
  );
}

function Bar({ p, width = 22 }: { p: number; width?: number }) {
  const filled = Math.round(Math.max(0, Math.min(1, p)) * width);
  return (
    <span className="lcd-bar">
      [{'█'.repeat(filled)}{'░'.repeat(width - filled)}]
    </span>
  );
}

function Meters({ active }: { active: boolean }) {
  const [bars, setBars] = useState<number[]>(() => Array(16).fill(0.1));
  useEffect(() => {
    if (!active) return;
    let t = 0;
    const iv = setInterval(() => {
      t += 1;
      setBars((prev) =>
        prev.map((v, i) => {
          const target = 0.25 + 0.7 * Math.abs(Math.sin(t * 0.35 + i * 0.9)) * (0.6 + Math.random() * 0.4);
          return v + (target - v) * 0.55;
        }),
      );
    }, 90);
    return () => clearInterval(iv);
  }, [active]);
  if (!active) return null;
  return (
    <div className="lcd-meters">
      {bars.map((b, i) => (
        <div key={i} className="lcd-meter"><div style={{ height: `${Math.round(b * 100)}%` }} /></div>
      ))}
    </div>
  );
}

const selEntry = (s: CtState): FileEntry | undefined =>
  s.files.find((f) => f.id === s.selectedId) ?? s.files[0];

function FileView({ s }: { s: CtState }) {
  const f = selEntry(s);
  if (!f) {
    return (
      <>
        <div className="lcd-line lcd-dim">NO FILES LOADED</div>
        <div className="lcd-line lcd-big">DROP AUDIO ON THE</div>
        <div className="lcd-line lcd-big">D·BEAM ◄──</div>
        <div className="lcd-line">&nbsp;</div>
        <div className="lcd-line lcd-dim">ANY FORMAT · EVEN VIDEO</div>
        <div className="lcd-line lcd-dim">WE EAT IT ALL</div>
      </>
    );
  }
  const i = s.files.indexOf(f);
  const p = f.probe;
  const plan = engine.plan(s.edit, p);
  const fmt = FORMATS[s.edit.format];
  const tags = p ? [p.tags.artist, p.tags.title].filter(Boolean).join(' - ') : '';

  if (f.status === 'converting') {
    const done = s.files.filter((x) => x.status === 'done').length;
    const active = s.files.filter((x) => ['queued', 'converting', 'done', 'error'].includes(x.status)).length;
    const batch = active ? (done + f.progress) / active : 0;
    return (
      <>
        <div className="lcd-line">
          <span className="lcd-inv"> {f.phase === 'analyze' ? 'ANALYZE R128' : 'CONVERTING'} </span>
          <span className="lcd-right">{i + 1}/{s.files.length}</span>
        </div>
        <div className="lcd-line"><Marq text={f.name.toUpperCase()} /></div>
        <div className="lcd-line">→ {fmt.name} {qualityOf(fmt, s.edit.quality).knob}</div>
        <div className="lcd-line"><Bar p={f.progress} /> {String(Math.round(f.progress * 100)).padStart(3)}%</div>
        <div className="lcd-line">
          TIME {fmtDur((p?.durationSec ?? 0) * f.progress)}/{fmtDur(p?.durationSec)}
          <span className="lcd-right">BATCH {Math.round(batch * 100)}%</span>
        </div>
        <Meters active />
      </>
    );
  }

  return (
    <>
      <div className="lcd-line">
        <span className="lcd-inv"> FILE {String(i + 1).padStart(2, '0')}/{String(s.files.length).padStart(2, '0')} </span>
        <span className="lcd-right">BANK {'ABCD'[Math.floor(i / 16)]}</span>
      </div>
      <div className="lcd-line lcd-big"><Marq text={f.name.toUpperCase()} max={26} /></div>
      <div className="lcd-line">
        {f.status === 'probing' && 'ANALYZING…'}
        {f.status !== 'probing' && p && (
          <>
            {(p.codec ?? '?').toUpperCase()} {fmtRate(p.sampleRate)} {fmtDepth(p.bitDepth)} {fmtChannels(p.channels)}
            {p.bitrateKbps ? ` ${p.bitrateKbps}K` : ''}
          </>
        )}
        {f.status === 'error' && !p && 'UNREADABLE'}
      </div>
      <div className="lcd-line lcd-dim">
        {fmtDur(p?.durationSec)} · {fmtBytes(f.size)}{tags ? ' · ' : ''}<Marq text={tags.toUpperCase()} max={18} />
      </div>
      <div className="lcd-line">
        → {fmt.knob} {qualityOf(fmt, s.edit.quality).knob} {fmtRate(plan.effective.rate)}
        {plan.effective.depth ? ` ${fmtDepth(plan.effective.depth)}` : ''} {fmtChannels(plan.effective.channels)}
      </div>
      <div className="lcd-line">
        {f.status === 'done' && f.result && (
          <>
            <span className="lcd-inv"> DONE </span> {fmtBytes(f.result.size)} · {(f.result.elapsedMs / 1000).toFixed(1)}S · 2×TAP PAD=SAVE
          </>
        )}
        {f.status === 'error' && <span className="lcd-blink">ERR: {f.error?.slice(0, 24) ?? '?'}</span>}
        {(f.status === 'ready' || f.status === 'queued') && (
          <span className="lcd-dim">{plan.badges.slice(0, 3).join(' · ') || 'READY'}</span>
        )}
        {f.status === 'probing' && <span className="lcd-blink">READING…</span>}
      </div>
    </>
  );
}

function PresetView({ s }: { s: CtState }) {
  const loaded = s.presets[s.presetIndex];
  const dirty = loaded
    ? JSON.stringify({ ...s.edit, id: 0, name: 0, factory: 0 }) !== JSON.stringify({ ...loaded, id: 0, name: 0, factory: 0 })
    : true;
  const fmt = FORMATS[s.edit.format];
  const qv = qualityOf(fmt, s.edit.quality);
  const label = loaded
    ? `${loaded.factory ? 'P' : 'U'}${String(
        (loaded.factory
          ? s.presets.filter((p) => p.factory).indexOf(loaded)
          : s.presets.filter((p) => !p.factory).indexOf(loaded)) + 1,
      ).padStart(2, '0')}`
    : '---';
  return (
    <>
      <div className="lcd-line">
        <span className="lcd-inv"> PATCH {label}{dirty ? '*' : ' '} </span>
        <span className="lcd-right">{loaded?.name ?? 'CUSTOM'}</span>
      </div>
      <div className="lcd-line">FMT : {fmt.name}</div>
      <div className="lcd-line">QUAL: {qv.lcd}</div>
      <div className="lcd-line">
        RATE: {s.edit.rate === 'keep' ? 'KEEP' : fmtRate(s.edit.rate)}
        <span className="lcd-right">BITS: {s.edit.depth === 'keep' ? 'KEEP' : fmtDepth(s.edit.depth)}</span>
      </div>
      <div className="lcd-line">
        CHAN: {s.edit.channels === 'keep' ? 'KEEP' : s.edit.channels === 1 ? 'MONO' : 'STEREO'}
        <span className="lcd-right">DTHR: {s.edit.dither.toUpperCase().replace('TRIANGULAR_HP', 'TPDF-HP').slice(0, 8)}</span>
      </div>
      <div className="lcd-line">
        NORM: {s.edit.norm === 'off' ? 'OFF' : `${s.edit.norm} LUFS`}
        <span className="lcd-right">TRIM: {s.edit.gainDb > 0 ? '+' : ''}{s.edit.gainDb.toFixed(1)}DB</span>
      </div>
      <div className="lcd-line lcd-dim">DIAL=BROWSE · WRITE=STORE PATCH</div>
    </>
  );
}

function SysView({ s }: { s: CtState }) {
  const row = (k: string, v: string, onClick?: () => void) => (
    <div className={`lcd-line ${onClick ? 'lcd-click' : ''}`} onClick={onClick}>
      {k.padEnd(9, ' ')}: {v}{onClick ? <span className="lcd-right lcd-dim">◄TAP</span> : null}
    </div>
  );
  return (
    <>
      <div className="lcd-line"><span className="lcd-inv"> SYSTEM </span><span className="lcd-right">CT-505 v0.1 ACID</span></div>
      {row('DSP CORE', s.engineState === 'ready' ? `READY · ${s.soxr ? 'SOXR 28BIT' : 'SWR 256TAP F64'}` : s.engineState.toUpperCase())}
      {row('SOUND', s.sound ? 'ON' : 'OFF', toggleSound)}
      {row('AUTO-DL', s.autoDl ? 'ON' : 'OFF', toggleAutoDl)}
      {row('TRIP', s.trip ? 'ENGAGED ☺' : 'OFF', toggleTrip)}
      {row('ENGINE', 'FFMPEG.WASM · LOCAL ONLY')}
      <div className="lcd-line lcd-dim">FILES NEVER LEAVE THIS MACHINE</div>
    </>
  );
}

function LogView({ s }: { s: CtState }) {
  const lines = s.logs.slice(-8);
  return (
    <>
      <div className="lcd-line"><span className="lcd-inv"> DSP LOG </span></div>
      {lines.length === 0 && <div className="lcd-line lcd-dim">SILENCE ON THE BUS…</div>}
      {lines.map((l, i) => (
        <div key={i} className="lcd-log">{l.slice(0, 64)}</div>
      ))}
    </>
  );
}

const PAGES: { id: LcdPage; label: string }[] = [
  { id: 'file', label: 'FILE' },
  { id: 'preset', label: 'PATCH' },
  { id: 'sys', label: 'SYS' },
  { id: 'log', label: 'LOG' },
];

export function Lcd() {
  const s = useCt();
  const booting = s.engineState !== 'ready';
  const [dots, setDots] = useState(0);
  useEffect(() => {
    if (!booting) return;
    const iv = setInterval(() => setDots((d) => (d + 1) % 4), 350);
    return () => clearInterval(iv);
  }, [booting]);

  const body = useMemo(() => {
    if (booting) {
      return (
        <>
          <div className="lcd-line lcd-big">ConverT CT-505</div>
          <div className="lcd-line lcd-dim">TOTAL SONIC CONVERSION SYSTEM</div>
          <div className="lcd-line">&nbsp;</div>
          <div className="lcd-line">{s.engineMsg}{'.'.repeat(dots)}</div>
          <div className="lcd-line">&nbsp;</div>
          <div className="lcd-line lcd-dim">{s.engineState === 'error' ? 'RELOAD PAGE TO RETRY' : 'WARMING UP THE GOLD CABLES'}</div>
        </>
      );
    }
    switch (s.lcdPage) {
      case 'preset': return <PresetView s={s} />;
      case 'sys': return <SysView s={s} />;
      case 'log': return <LogView s={s} />;
      default: return <FileView s={s} />;
    }
  }, [s, booting, dots]);

  return (
    <div className="lcd-block">
      <div className={`lcd ${s.trip ? 'lcd-trip' : ''}`}>
        <div className="lcd-glass" />
        <div className="lcd-content">
          {body}
          {s.toast && <div className="lcd-toast">{s.toast}</div>}
        </div>
      </div>
      <div className="lcd-funcs">
        {PAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`func-btn ${s.lcdPage === p.id && !booting ? 'func-on' : ''}`}
            onClick={() => setPage(p.id)}
            disabled={booting}
          >
            <span className="func-led" />
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
