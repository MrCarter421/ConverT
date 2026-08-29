// The big VALUE dial — browses patch memory. WRITE stores, KILL deletes.

import { useEffect, useRef, useState } from 'react';
import { deletePreset, dialPreset, savePreset, useCt } from '../../state/store';

export function PresetDial() {
  const { presets, presetIndex } = useCt();
  const [spin, setSpin] = useState(0); // cosmetic continuous angle
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ angle: number; acc: number } | null>(null);

  const p = presets[presetIndex];
  const label = p
    ? `${p.factory ? 'P' : 'U'}${String(
        (p.factory
          ? presets.filter((x) => x.factory).indexOf(p)
          : presets.filter((x) => !x.factory).indexOf(p)) + 1,
      ).padStart(2, '0')}`
    : '---';

  const bump = (d: number) => {
    dialPreset(d);
    setSpin((a) => a + d * 24);
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      bump(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const angleAt = (e: React.PointerEvent): number => {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  return (
    <div className="dial-block" ref={rootRef}>
      <div className="section-title">PATCH <span className="section-sub">PRESET MEMORY</span></div>
      <div className="dial-row">
        <svg
          width={128}
          height={128}
          viewBox="0 0 128 128"
          className="dial"
          role="slider"
          aria-label="Preset select"
          aria-valuenow={presetIndex}
          aria-valuemin={0}
          aria-valuemax={presets.length - 1}
          aria-valuetext={p?.name}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); bump(1); }
            if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); bump(-1); }
          }}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            drag.current = { angle: angleAt(e), acc: 0 };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const a = angleAt(e);
            let d = a - drag.current.angle;
            if (d > 180) d -= 360;
            if (d < -180) d += 360;
            drag.current.angle = a;
            drag.current.acc += d;
            setSpin((s) => s + d);
            while (drag.current.acc >= 24) { drag.current.acc -= 24; dialPreset(1); }
            while (drag.current.acc <= -24) { drag.current.acc += 24; dialPreset(-1); }
          }}
          onPointerUp={() => { drag.current = null; }}
        >
          <circle cx={64} cy={64} r={58} className="dial-ring" />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i * 15 * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={64 + Math.cos(a) * 52} y1={64 + Math.sin(a) * 52}
                x2={64 + Math.cos(a) * 57} y2={64 + Math.sin(a) * 57}
                className="dial-ridge"
              />
            );
          })}
          <circle cx={64} cy={64} r={48} className="dial-body" />
          <circle cx={64} cy={64} r={47} className="dial-knurl" />
          <circle cx={64} cy={64} r={20} className="dial-cap" />
          <g transform={`rotate(${spin} 64 64)`}>
            <circle cx={64} cy={26} r={4} className="dial-marker" />
          </g>
        </svg>
        <div className="dial-side">
          <div className="mini-lcd">{label}</div>
          <button type="button" className="mini-btn write-btn" onClick={savePreset}>WRITE</button>
          <button type="button" className="mini-btn" onClick={deletePreset}>KILL</button>
        </div>
      </div>
      <div className="dial-name">{p?.name ?? 'CUSTOM PATCH'}</div>
    </div>
  );
}
