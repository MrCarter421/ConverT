// The CT-505 faceplate — every panel bolted into place.

import { Lcd } from './components/Lcd';
import { Pads } from './components/Pads';
import { DropBeam } from './components/DropBeam';
import { Transport } from './components/Transport';
import { PresetDial } from './components/PresetDial';
import { GainSlider } from './components/GainSlider';
import { SevenSeg } from './components/SevenSeg';
import { ModifyPanel } from './panels/ModifyPanel';
import { useCt } from '../state/store';

function Screw({ className }: { className: string }) {
  return (
    <div className={`screw ${className}`} aria-hidden>
      <div className="screw-slot" />
    </div>
  );
}

function Header() {
  const { engineState, running, soxr } = useCt();
  return (
    <header className="ct-header">
      <div className="brand">
        <div className="brand-logo">
          Conver<span className="brand-t">T</span>
        </div>
        <div className="brand-oval">convertbox</div>
      </div>
      <div className="brand-mid">
        <div className="brand-squares" aria-hidden>
          {['#e4322b', '#f47b20', '#f5c518', '#5fb44a', '#2b7fd4', '#8455a5'].map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </div>
        <div className="brand-tag">TOTAL SONIC CONVERSION SYSTEM · 24BIT/192K · {soxr ? 'SOXR' : 'FLOAT64'} DSP</div>
      </div>
      <div className="brand-right">
        <div className="brand-model">CT-505</div>
        <div className="header-leds">
          <span className="hled"><i className={`led ${engineState === 'ready' ? 'led-green' : 'led-amber led-blink'}`} />PWR</span>
          <span className="hled"><i className={`led ${engineState === 'ready' ? 'led-green led-dim' : 'led-off'}`} />DSP</span>
          <span className="hled"><i className={`led ${running ? 'led-red led-blink' : 'led-off'}`} />BUSY</span>
        </div>
      </div>
    </header>
  );
}

function SegPanel() {
  const s = useCt();
  const done = s.files.filter((f) => f.status === 'done').length;
  const converting = s.files.find((f) => f.status === 'converting');
  let value: string;
  if (s.running) {
    const active = s.files.filter((f) => ['queued', 'converting', 'done', 'error'].includes(f.status)).length;
    const pct = active ? Math.round(((done + (converting?.progress ?? 0)) / active) * 100) : 0;
    value = String(Math.min(100, pct));
  } else {
    value = String(s.files.length);
  }
  return (
    <div className="seg-panel">
      <div className="section-title">STATUS</div>
      <SevenSeg value={value} digits={3} label={s.running ? 'PROGRESS %' : 'FILES'} />
      <div className="seg-mode">
        <span className={s.running ? 'seg-mode-off' : 'seg-mode-on'}>FILES</span>
        <span className={s.running ? 'seg-mode-on' : 'seg-mode-off'}>PROG%</span>
      </div>
      <div className="seg-done">DONE {done}</div>
    </div>
  );
}

export function Faceplate({ dragging }: { dragging: boolean }) {
  return (
    <div className="faceplate">
      <Screw className="screw-tl" />
      <Screw className="screw-tr" />
      <Screw className="screw-bl" />
      <Screw className="screw-br" />
      <div className="silk-spiral silk-spiral-l" aria-hidden />
      <div className="silk-spiral silk-spiral-r" aria-hidden />

      <Header />

      <div className="ct-mid">
        <div className="ct-mid-left">
          <DropBeam dragging={dragging} />
          <PresetDial />
        </div>
        <div className="ct-mid-center">
          <div className="section-title">DISPLAY <span className="section-sub">CONVERSION MONITOR</span></div>
          <Lcd />
        </div>
        <div className="ct-mid-right">
          <SegPanel />
          <GainSlider />
        </div>
      </div>

      <ModifyPanel />

      <div className="ct-bottom">
        <Pads />
        <Transport />
      </div>

      <footer className="ct-footer">
        <div className="silk-hints">
          KNOBS: DRAG / SCROLL / TAP · PAD: TAP=SELECT 2×TAP=SAVE · DEL=REMOVE · ESC=STOP
        </div>
        <div className="silk-slogan">turn on · tune in · transcode</div>
        <div className="serial">
          <div className="barcode" aria-hidden />
          <div className="serial-no">SER.NO CT505-ACID-001 · MADE FOR AUDIO HEADS</div>
        </div>
      </footer>
    </div>
  );
}
