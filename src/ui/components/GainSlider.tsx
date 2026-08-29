// OUTPUT TRIM fader. 0.0 dB = true bypass (LED dark, samples untouched).

import { useRef } from 'react';
import { setEdit, useCt } from '../../state/store';

const MIN = -12;
const MAX = 12;

export function GainSlider() {
  const gain = useCt((s) => s.edit.gainDb);
  const trackRef = useRef<HTMLDivElement>(null);

  const setFromY = (clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const t = 1 - Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    let db = MIN + t * (MAX - MIN);
    db = Math.round(db * 2) / 2;
    if (Math.abs(db) < 0.75) db = 0; // center detent
    setEdit({ gainDb: db });
  };

  const pos = 1 - (gain - MIN) / (MAX - MIN);

  return (
    <div className="fader-block">
      <div className="fader-title">TRIM</div>
      <div
        className="fader-track"
        ref={trackRef}
        role="slider"
        aria-label="Output trim dB"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={gain}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') setEdit({ gainDb: Math.min(MAX, gain + 0.5) });
          if (e.key === 'ArrowDown') setEdit({ gainDb: Math.max(MIN, gain - 0.5) });
          if (e.key === 'Home') setEdit({ gainDb: 0 });
        }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          setFromY(e.clientY);
        }}
        onPointerMove={(e) => e.buttons === 1 && setFromY(e.clientY)}
        onDoubleClick={() => setEdit({ gainDb: 0 })}
      >
        <div className="fader-scale">
          {['+12', '+6', '0', '-6', '-12'].map((t) => <span key={t}>{t}</span>)}
        </div>
        <div className="fader-slot" />
        <div className="fader-thumb" style={{ top: `${pos * 100}%` }} />
      </div>
      <span className={`led fader-led ${gain !== 0 ? 'led-red' : 'led-off'}`} title={gain !== 0 ? 'trim active' : 'bypass'} />
      <div className="fader-value">{gain > 0 ? '+' : ''}{gain.toFixed(1)}dB</div>
    </div>
  );
}
