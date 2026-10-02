// The two things you actually touch: the preset pill and the big gel button.

import {
  downloadAll, isModified, loadedPreset, openPopup, pendingFiles, runProgress,
  startBatch, stopBatch, useCt,
} from '../../state/store';
import { presetDetail, presetTitle } from '../../audio/presets';
import { IconChevron, IconDown, IconPlay, IconStop } from './Icons';

export function PresetPill() {
  const s = useCt();
  const loaded = loadedPreset(s);
  const modified = isModified(s);
  const title = loaded && !modified ? loaded.name : presetTitle(s.edit);
  const detail = presetDetail(s.edit);
  return (
    <button
      type="button"
      className="preset-pill"
      onClick={() => openPopup('preset')}
      aria-haspopup="dialog"
      title="Choose a preset or dial in your own"
    >
      <span className="pill-label">
        Preset{modified ? <em> · custom</em> : null}
      </span>
      <span className="pill-title">{title}</span>
      <span className="pill-detail">{detail}</span>
      <span className="pill-chev" aria-hidden><IconChevron size={18} /></span>
    </button>
  );
}

export function ConvertButton() {
  const s = useCt();
  const ready = s.engineState === 'ready';
  const pending = pendingFiles(s);
  const hasDone = s.files.some((f) => f.status === 'done');

  if (s.running) {
    return (
      <button type="button" className="gel gel-stop go-btn" onClick={() => void stopBatch()} title="Stop (Esc)">
        <IconStop size={18} />
        <span>Stop · {Math.round(runProgress(s) * 100)}%</span>
      </button>
    );
  }

  if (!pending.length && hasDone) {
    return (
      <button type="button" className="gel gel-blue go-btn" onClick={() => void downloadAll()} title="Download the converted files again">
        <IconDown size={20} />
        <span>Save</span>
      </button>
    );
  }

  const disabled = !ready || pending.length === 0;
  return (
    <button
      type="button"
      className={`gel gel-go go-btn ${!disabled ? 'is-armed' : ''}`}
      onClick={() => void startBatch()}
      disabled={disabled}
      title={!ready ? 'Engine warming up…' : pending.length ? `Convert ${pending.length} file${pending.length === 1 ? '' : 's'} and download` : 'Add files first'}
    >
      <IconPlay size={20} />
      <span>{!ready && s.files.length ? 'Wait…' : 'Convert'}</span>
    </button>
  );
}
