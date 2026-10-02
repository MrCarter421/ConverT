// Form controls in the house skin: chip rows, glass selects, gel switches.

import { IconChevron } from './Icons';

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

export function Chips<T extends string | number>({
  label, options, value, onChange, name,
}: {
  label: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`chip ${o.value === value ? 'is-on' : ''}`}
          onClick={() => onChange(o.value)}
          title={o.hint}
          data-chip={`${name}:${o.value}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string | number>({
  label, value, options, onChange, disabled, note,
}: {
  label: string;
  value: T;
  options: ChipOption<T>[];
  onChange: (v: T) => void;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <label className={`field ${disabled ? 'is-disabled' : ''}`}>
      <span className="field-label">{label}</span>
      <span className="select-wrap">
        <select
          value={String(value)}
          disabled={disabled}
          onChange={(e) => {
            const hit = options.find((o) => String(o.value) === e.target.value);
            if (hit) onChange(hit.value);
          }}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
          ))}
        </select>
        <IconChevron size={14} className="select-chev" />
      </span>
      {note && <span className="field-note">{note}</span>}
    </label>
  );
}

export function Switch({
  label, hint, checked, onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="switch-row">
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        {hint && <span className="switch-hint">{hint}</span>}
      </span>
      <input type="checkbox" className="switch" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
