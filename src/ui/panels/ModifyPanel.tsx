// CONVERSION MODIFY — the knob row. Scales adapt to the selected format.

import { Knob, type KnobValue } from '../components/Knob';
import { setEdit, setFormat, useCt } from '../../state/store';
import { FORMATS, FORMAT_ORDER, ratesForFormat } from '../../audio/formats';
import { fmtRate } from '../../util/fmt';
import type { BitDepthChoice, ChannelsChoice, DitherChoice, NormChoice } from '../../types';

const DITHERS: { id: DitherChoice; label: string }[] = [
  { id: 'auto', label: 'AUTO' },
  { id: 'off', label: 'OFF' },
  { id: 'triangular_hp', label: 'TPDF-HP' },
  { id: 'triangular', label: 'TPDF' },
  { id: 'shibata', label: 'SHIB' },
  { id: 'low_shibata', label: 'LO-SHB' },
  { id: 'high_shibata', label: 'HI-SHB' },
  { id: 'lipshitz', label: 'LIPSH' },
  { id: 'improved_e_weighted', label: 'E-WGT' },
];

const NORMS: { id: NormChoice; label: string }[] = [
  { id: 'off', label: 'OFF' },
  { id: -14, label: '-14' },
  { id: -16, label: '-16' },
  { id: -18, label: '-18' },
  { id: -23, label: '-23' },
];

const CHANNELS: { id: ChannelsChoice; label: string }[] = [
  { id: 'keep', label: 'KEEP' },
  { id: 1, label: 'MONO' },
  { id: 2, label: 'ST' },
];

export function ModifyPanel() {
  const edit = useCt((s) => s.edit);
  const fmt = FORMATS[edit.format];

  const formatValues: KnobValue[] = FORMAT_ORDER.map((id) => ({ id, label: FORMATS[id].knob }));
  const qualityValues: KnobValue[] = fmt.qualities.map((q) => ({ id: q.id, label: q.knob }));
  const rateValues: KnobValue[] = [
    { id: 'keep', label: 'KEEP' },
    ...ratesForFormat(fmt).map((r) => ({ id: String(r), label: fmtRate(r) })),
  ];
  const depthValues: KnobValue[] = fmt.depths
    ? [{ id: 'keep', label: 'KEEP' }, ...fmt.depths.map((d) => ({ id: String(d), label: d === '32f' ? '32F' : `${d}` }))]
    : [{ id: 'na', label: '—' }];

  const rateId = edit.rate === 'keep' ? 'keep' : String(edit.rate);
  const depthId = edit.depth === 'keep' ? 'keep' : String(edit.depth);

  return (
    <div className="modify">
      <div className="section-title">CONVERSION MODIFY <span className="section-sub">REALTIME PARAMETER EDIT</span></div>
      <div className="knob-row">
        <Knob
          label="FORMAT"
          values={formatValues}
          index={Math.max(0, FORMAT_ORDER.indexOf(edit.format))}
          onChange={(i) => setFormat(FORMAT_ORDER[i])}
          accent="green"
        />
        <Knob
          label="QUALITY"
          values={qualityValues}
          index={Math.max(0, fmt.qualities.findIndex((q) => q.id === edit.quality))}
          onChange={(i) => setEdit({ quality: fmt.qualities[i].id })}
          disabled={fmt.qualities.length <= 1}
        />
        <Knob
          label="RATE"
          values={rateValues}
          index={Math.max(0, rateValues.findIndex((v) => v.id === rateId))}
          onChange={(i) => setEdit({ rate: rateValues[i].id === 'keep' ? 'keep' : Number(rateValues[i].id) })}
        />
        <Knob
          label="BITS"
          values={depthValues}
          index={Math.max(0, depthValues.findIndex((v) => v.id === depthId))}
          onChange={(i) => {
            const id = depthValues[i].id;
            const depth: BitDepthChoice = id === 'keep' ? 'keep' : id === '32f' ? '32f' : (Number(id) as 16 | 24);
            setEdit({ depth });
          }}
          disabled={!fmt.depths}
        />
        <Knob
          label="CHANNEL"
          values={CHANNELS.map((c) => ({ id: String(c.id), label: c.label }))}
          index={Math.max(0, CHANNELS.findIndex((c) => c.id === edit.channels))}
          onChange={(i) => setEdit({ channels: CHANNELS[i].id })}
        />
        <Knob
          label="DITHER"
          values={DITHERS.map((d) => ({ id: d.id, label: d.label }))}
          index={Math.max(0, DITHERS.findIndex((d) => d.id === edit.dither))}
          onChange={(i) => setEdit({ dither: DITHERS[i].id })}
          disabled={!fmt.depths}
        />
        <Knob
          label="R128 NORM"
          values={NORMS.map((v) => ({ id: String(v.id), label: v.label }))}
          index={Math.max(0, NORMS.findIndex((v) => v.id === edit.norm))}
          onChange={(i) => setEdit({ norm: NORMS[i].id })}
          accent="green"
        />
      </div>
    </div>
  );
}
