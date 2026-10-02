// The preset pop-up. Left: the library. Right: dial in format + quality, with
// every deeper setting one click away under "More options".

import { useState } from 'react';
import {
  closePopup, deletePreset, isModified, loadPreset, savePreset, setEdit, setFormat, useCt,
} from '../../state/store';
import { FORMATS, FORMAT_ORDER, qualityOf, ratesForFormat } from '../../audio/formats';
import {
  PRESET_GROUPS, autoName, ditherLabel, presetDetail, presetTitle,
} from '../../audio/presets';
import { fmtRate } from '../../util/fmt';
import type {
  BitDepthChoice, ChannelsChoice, DitherChoice, FormatId, NormChoice, Preset, RateChoice,
} from '../../types';
import { Window } from './Window';
import { Chips, Select, type ChipOption } from '../components/Fields';
import { IconChevron, IconSave, IconTrash } from '../components/Icons';

const LS_ADV = 'convert.ui.adv';

const DITHERS: DitherChoice[] = [
  'auto', 'off', 'triangular_hp', 'triangular', 'shibata', 'low_shibata', 'high_shibata',
  'lipshitz', 'improved_e_weighted',
];

const NORMS: ChipOption<NormChoice>[] = [
  { value: 'off', label: 'Off' },
  { value: -14, label: '−14 LUFS · streaming' },
  { value: -16, label: '−16 LUFS · podcast' },
  { value: -18, label: '−18 LUFS · dynamic' },
  { value: -23, label: '−23 LUFS · EBU broadcast' },
];

const CHANNELS: ChipOption<ChannelsChoice>[] = [
  { value: 'keep', label: 'Keep source' },
  { value: 1, label: 'Mono' },
  { value: 2, label: 'Stereo' },
];

const hasAdvanced = (p: Preset) =>
  p.rate !== 'keep' || p.depth !== 'keep' || p.channels !== 'keep' ||
  p.dither !== 'auto' || p.norm !== 'off' || p.gainDb !== 0;

function readAdv(): boolean | null {
  try {
    const v = localStorage.getItem(LS_ADV);
    return v === null ? null : v === '1';
  } catch { return null; }
}

function Library() {
  const s = useCt();
  const modified = isModified(s);
  return (
    <nav className="library" aria-label="Preset library">
      {PRESET_GROUPS.map((g) => {
        const items = s.presets.filter((p) => (p.factory ? p.group : 'mine') === g.id);
        if (!items.length && g.id !== 'mine') return null;
        return (
          <section key={g.id} className="lib-group">
            <h3>{g.label} <small>{g.hint}</small></h3>
            {!items.length && <p className="lib-empty">Dial in a sound, then “Save as preset”.</p>}
            <ul>
              {items.map((p) => {
                const on = p.id === s.presetId;
                return (
                  <li key={p.id} className={`lib-item ${on ? (modified ? 'is-base' : 'is-on') : ''}`}>
                    <button
                      type="button"
                      className="lib-hit"
                      onClick={() => loadPreset(p.id)}
                      onDoubleClick={() => { loadPreset(p.id); closePopup(); }}
                      aria-current={on && !modified ? 'true' : undefined}
                      data-preset={p.id}
                    >
                      <span className="lib-name">{p.name}</span>
                      <span className="lib-detail">{presetDetail(p)}</span>
                    </button>
                    {!p.factory && (
                      <button type="button" className="lib-del" onClick={() => deletePreset(p.id)} aria-label={`Delete preset ${p.name}`} title="Delete preset">
                        <IconTrash size={14} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}

function FormatPicker({ value }: { value: FormatId }) {
  const rows: { label: string; ids: FormatId[] }[] = [
    { label: 'Lossless', ids: FORMAT_ORDER.filter((id) => FORMATS[id].lossless) },
    { label: 'Lossy', ids: FORMAT_ORDER.filter((id) => !FORMATS[id].lossless) },
  ];
  return (
    <div className="fmt-picker" role="radiogroup" aria-label="Format">
      {rows.map((r) => (
        <div key={r.label} className="fmt-row">
          <span className="fmt-kind">{r.label}</span>
          <div className="chips">
            {r.ids.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={id === value}
                className={`chip ${id === value ? 'is-on' : ''}`}
                onClick={() => setFormat(id)}
                title={FORMATS[id].blurb}
                data-chip={`format:${id}`}
              >
                {id === 'wv' ? 'WavPack' : FORMATS[id].knob}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Advanced({ edit }: { edit: Preset }) {
  const fmt = FORMATS[edit.format];
  const rates: ChipOption<RateChoice>[] = [
    { value: 'keep', label: fmt.rates ? 'Keep source (nearest legal)' : 'Keep source' },
    ...ratesForFormat(fmt).map((r) => ({ value: r, label: `${fmtRate(r).replace('K', '')} kHz` })),
  ];
  const depths: ChipOption<BitDepthChoice>[] = fmt.depths
    ? [
        { value: 'keep', label: 'Auto · match source' },
        ...fmt.depths.map((d) => ({ value: d, label: d === '32f' ? '32-bit float' : `${d}-bit` })),
      ]
    : [{ value: 'keep', label: 'Set by encoder' }];
  const dithers: ChipOption<DitherChoice>[] = DITHERS.map((d) => ({
    value: d,
    label: d === 'auto' ? 'Auto · Shibata / TPDF-HP' : ditherLabel(d),
  }));

  return (
    <div className="adv-grid">
      <Select label="Sample rate" value={edit.rate} options={rates} onChange={(rate) => setEdit({ rate })} />
      <Select
        label="Bit depth" value={edit.depth} options={depths} onChange={(depth) => setEdit({ depth })}
        disabled={!fmt.depths}
      />
      <Select label="Channels" value={edit.channels} options={CHANNELS} onChange={(channels) => setEdit({ channels })} />
      <Select
        label="Dither" value={edit.dither} options={dithers} onChange={(dither) => setEdit({ dither })}
        disabled={!fmt.depths} note={fmt.depths ? 'only on reduction to 16-bit' : undefined}
      />
      <Select label="Loudness (EBU R128)" value={edit.norm} options={NORMS} onChange={(norm) => setEdit({ norm })} />
      <label className="field">
        <span className="field-label">
          Gain trim <b className="gain-val">{edit.gainDb > 0 ? '+' : ''}{edit.gainDb.toFixed(1)} dB</b>
        </span>
        <input
          type="range" className="range" min={-12} max={12} step={0.5}
          value={edit.gainDb}
          onChange={(e) => setEdit({ gainDb: Number(e.target.value) })}
          onDoubleClick={() => setEdit({ gainDb: 0 })}
          aria-label="Gain trim in dB"
        />
        <span className="field-note">{edit.gainDb === 0 ? 'bypassed · samples untouched' : 'double-click to reset'}</span>
      </label>
    </div>
  );
}

function SaveBar({ edit }: { edit: Preset }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  if (!naming) {
    return (
      <button
        type="button" className="btn-glass"
        onClick={() => { setName(autoName(edit)); setNaming(true); }}
      >
        <IconSave size={15} /> Save as preset…
      </button>
    );
  }
  const commit = () => { savePreset(name); setNaming(false); };
  return (
    <form className="save-form" onSubmit={(e) => { e.preventDefault(); commit(); }}>
      <input
        className="text-input" value={name} maxLength={40} autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setNaming(false); } }}
        aria-label="Preset name"
      />
      <button type="submit" className="btn-glass is-primary">Save</button>
      <button type="button" className="btn-glass" onClick={() => setNaming(false)}>Cancel</button>
    </form>
  );
}

export function PresetWindow() {
  const s = useCt();
  const edit = s.edit;
  const loaded = s.presets.find((p) => p.id === s.presetId);
  const modified = isModified(s);
  const fmt = FORMATS[edit.format];
  const qv = qualityOf(fmt, edit.quality);
  const [adv, setAdv] = useState<boolean>(() => readAdv() ?? hasAdvanced(edit));
  const toggleAdv = () => {
    setAdv(!adv);
    try { localStorage.setItem(LS_ADV, adv ? '0' : '1'); } catch { /* private mode */ }
  };

  return (
    <Window
      title="Presets"
      className="preset-win"
      footer={(
        <>
          <SaveBar edit={edit} />
          <span className="foot-summary" aria-live="polite">
            <b>{loaded && !modified ? loaded.name : presetTitle(edit)}</b>
            <span>{modified ? 'custom · ' : ''}{presetDetail(edit)}</span>
          </span>
          <button type="button" className="gel gel-blue done-btn" onClick={closePopup}>Done</button>
        </>
      )}
    >
      <div className="preset-cols">
        <Library />
        <div className="dial">
          <h2 className="dial-h">Format</h2>
          <FormatPicker value={edit.format} />
          <p className="dial-blurb">{fmt.blurb}</p>

          <h2 className="dial-h">Quality</h2>
          {fmt.qualities.length > 1 ? (
            <Chips
              name="quality"
              label="Quality"
              value={edit.quality}
              onChange={(quality) => setEdit({ quality })}
              options={fmt.qualities.map((q) => ({ value: q.id, label: q.knob, hint: q.lcd }))}
            />
          ) : (
            <p className="dial-blurb">{fmt.lossless ? 'Lossless — there’s no quality to lose.' : qv.lcd}</p>
          )}
          {fmt.qualities.length > 1 && <p className="dial-lcd">{qv.lcd}</p>}

          <button type="button" className="disclosure" aria-expanded={adv} onClick={toggleAdv}>
            <IconChevron size={16} className="disc-chev" />
            More options
            <small>rate · bit depth · channels · dither · loudness · gain</small>
          </button>
          {adv && <Advanced edit={edit} />}
        </div>
      </div>
    </Window>
  );
}
