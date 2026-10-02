// Options: downloads, sound, skin, motion, and a peek at the engine.

import { useEffect, useRef, useState } from 'react';
import { closePopup, setSettings, useCt } from '../../state/store';
import type { Skin } from '../../types';
import { Window } from './Window';
import { Chips, Switch } from '../components/Fields';
import { IconChevron } from '../components/Icons';

function EngineLog() {
  const logs = useCt((s) => s.logs);
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);
  return <pre className="log-box" ref={ref}>{logs.slice(-80).join('\n') || 'Quiet on the bus…'}</pre>;
}

export function SettingsWindow() {
  const s = useCt();
  const [showLog, setShowLog] = useState(false);
  return (
    <Window
      title="Options"
      className="settings-win"
      footer={<button type="button" className="gel gel-blue done-btn" onClick={closePopup}>Done</button>}
    >
      <section className="opt-group">
        <h2 className="dial-h">Downloads</h2>
        <Switch
          label="Download automatically"
          hint="Converted files save as soon as the batch finishes"
          checked={s.autoDl}
          onChange={(autoDl) => setSettings({ autoDl })}
        />
        <Switch
          label="Batches as one .zip"
          hint="Off: each file downloads separately"
          checked={s.zipBatch}
          onChange={(zipBatch) => setSettings({ zipBatch })}
        />
      </section>

      <section className="opt-group">
        <h2 className="dial-h">Look &amp; feel</h2>
        <div className="opt-row">
          <span className="switch-label">Skin</span>
          <Chips<Skin>
            name="skin"
            label="Skin"
            value={s.skin}
            onChange={(skin) => setSettings({ skin })}
            options={[
              { value: 'day', label: 'Aqua Day' },
              { value: 'night', label: 'Aurora Night' },
            ]}
          />
        </div>
        <Switch
          label="Animated sky"
          hint="Drifting clouds and bubbles"
          checked={s.motion}
          onChange={(motion) => setSettings({ motion })}
        />
        <Switch
          label="Interface sounds"
          hint="Soft clicks and a chime when a batch is done"
          checked={s.sound}
          onChange={(sound) => setSettings({ sound })}
        />
      </section>

      <section className="opt-group">
        <h2 className="dial-h">Engine</h2>
        <dl className="kv">
          <dt>Core</dt>
          <dd>FFmpeg (WebAssembly) · runs 100% on this computer</dd>
          <dt>Status</dt>
          <dd>{s.engineState === 'ready' ? 'Ready' : s.engineState === 'error' ? 'Failed to load — reload the page' : 'Loading…'}</dd>
          <dt>Resampler</dt>
          <dd>{s.soxr ? 'SoX VHQ · 28-bit precision' : 'swresample · 256-tap filter · 64-bit float'}</dd>
        </dl>
        <button type="button" className="disclosure" aria-expanded={showLog} onClick={() => setShowLog(!showLog)}>
          <IconChevron size={16} className="disc-chev" />
          Engine log
        </button>
        {showLog && <EngineLog />}
      </section>
    </Window>
  );
}
