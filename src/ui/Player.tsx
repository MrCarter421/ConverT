// The main window. One column, four things: display, files, preset, convert.

import { openPopup, runProgress, useCt } from '../state/store';
import { TitleBar } from './components/TitleBar';
import { Display } from './components/Display';
import { Playlist } from './components/Playlist';
import { ConvertButton, PresetPill } from './components/Controls';
import { IconGear, IconHelp } from './components/Icons';
import { FileInput } from './filePicker';

function SeekBar() {
  const s = useCt();
  const allDone = s.files.length > 0 && s.files.every((f) => f.status === 'done');
  const p = s.running ? runProgress(s) : allDone ? 1 : 0;
  return (
    <div
      className={`seek ${s.running ? 'is-running' : ''} ${allDone && !s.running ? 'is-done' : ''}`}
      role="progressbar"
      aria-label="Batch progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
    >
      <i className="seek-fill" style={{ width: `${p * 100}%` }} />
      <i className="seek-thumb" style={{ left: `${p * 100}%` }} />
    </div>
  );
}

export function Player({ dragging }: { dragging: boolean }) {
  return (
    <section className={`win player ${dragging ? 'is-dragging' : ''}`} aria-label="ConverT">
      <TitleBar title="ConverT" logo>
        <button type="button" className="cap-btn" onClick={() => openPopup('help')} aria-label="How it works" title="How it works">
          <IconHelp size={14} />
        </button>
        <button type="button" className="cap-btn" onClick={() => openPopup('settings')} aria-label="Options" title="Options">
          <IconGear size={14} />
        </button>
      </TitleBar>
      <div className="player-body">
        <Display />
        <SeekBar />
        <Playlist />
        <div className="controls">
          <PresetPill />
          <ConvertButton />
        </div>
      </div>
      <FileInput />
      {dragging && (
        <div className="drop-overlay" aria-hidden>
          <span className="drop-bubble">Release to add</span>
        </div>
      )}
    </section>
  );
}
