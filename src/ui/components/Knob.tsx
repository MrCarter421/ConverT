// Rotary knob with printed tick scale, MC-505 style.
// Drag up/down or scroll to scrub, click to advance, arrow keys when focused.

import { useEffect, useRef } from 'react';

export interface KnobValue {
  id: string;
  label: string;
}

interface KnobProps {
  label: string;
  values: KnobValue[];
  index: number;
  onChange: (index: number) => void;
  disabled?: boolean;
  accent?: 'orange' | 'green';
}

const ARC_START = -135;
const ARC_END = 135;

export function Knob({ label, values, index, onChange, disabled, accent = 'orange' }: KnobProps) {
  const n = values.length;
  const clamped = Math.max(0, Math.min(n - 1, index));
  const angleFor = (i: number) => (n <= 1 ? 0 : ARC_START + (i / (n - 1)) * (ARC_END - ARC_START));
  const angle = angleFor(clamped);
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; start: number; moved: boolean } | null>(null);

  const step = (d: number) => {
    if (disabled || n <= 1) return;
    const next = (clamped + d + n) % n;
    onChange(next);
  };
  const jump = (i: number) => {
    if (disabled) return;
    onChange(Math.max(0, Math.min(n - 1, i)));
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (disabled) return;
      e.preventDefault();
      const d = e.deltaY > 0 ? -1 : 1;
      const next = Math.max(0, Math.min(n - 1, clamped + d));
      if (next !== clamped) onChange(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clamped, n, disabled, onChange]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, start: clamped, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = drag.current.y - e.clientY;
    if (Math.abs(dy) > 3) drag.current.moved = true;
    jump(drag.current.start + Math.round(dy / 16));
  };
  const onPointerUp = () => {
    if (drag.current && !drag.current.moved) step(1);
    drag.current = null;
  };

  const current = values[clamped];
  const R = 56;
  const CX = 78;
  const CY = 72;
  return (
    <div
      className={`knob ${disabled ? 'knob-disabled' : ''} knob-${accent}`}
      ref={rootRef}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={n - 1}
      aria-valuenow={clamped}
      aria-valuetext={current?.label ?? '—'}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); jump(clamped + 1); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); jump(clamped - 1); }
        if (e.key === 'Home') jump(0);
        if (e.key === 'End') jump(n - 1);
      }}
    >
      <svg
        width={156}
        height={130}
        viewBox="0 0 156 130"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* printed scale */}
        {values.map((v, i) => {
          const a = ((angleFor(i) - 90) * Math.PI) / 180;
          const x1 = CX + Math.cos(a) * (R - 12);
          const y1 = CY + Math.sin(a) * (R - 12);
          const x2 = CX + Math.cos(a) * (R - 6);
          const y2 = CY + Math.sin(a) * (R - 6);
          const lx = CX + Math.cos(a) * (R + 8);
          const ly = CY + Math.sin(a) * (R + 8);
          const active = i === clamped;
          return (
            <g key={v.id}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className={active ? 'knob-tick-on' : 'knob-tick'} />
              <text x={lx} y={ly + 2.5} textAnchor="middle" className={active ? 'knob-scale-on' : 'knob-scale'}>
                {v.label}
              </text>
            </g>
          );
        })}
        {/* body */}
        <circle cx={CX} cy={CY + 2.5} r={34} className="knob-shadow" />
        <circle cx={CX} cy={CY} r={32} className="knob-body" />
        <circle cx={CX} cy={CY} r={32} className="knob-knurl" />
        <circle cx={CX} cy={CY} r={22} className="knob-cap" />
        <g transform={`rotate(${angle} ${CX} ${CY})`}>
          <line x1={CX} y1={CY - 18} x2={CX} y2={CY - 31.5} className="knob-pointer" />
          <circle cx={CX} cy={CY - 26} r={2.4} className="knob-dot" />
        </g>
      </svg>
      <div className="knob-label">
        <span className="knob-name">{label}</span>
        <span className="knob-value">{disabled ? '—' : current?.label ?? '—'}</span>
      </div>
    </div>
  );
}
