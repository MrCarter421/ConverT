// The D·BEAM — but instead of waving your hand, you feed it files.

import { useRef } from 'react';
import { addFiles, useCt } from '../../state/store';

export const ACCEPT = [
  'audio/*', 'video/*',
  '.wav', '.mp3', '.flac', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.alac',
  '.aiff', '.aif', '.wma', '.wv', '.ape', '.mpc', '.tta', '.ac3', '.dts',
  '.amr', '.au', '.caf', '.mka', '.webm', '.mp4', '.mov', '.mkv', '.avi', '.m4b', '.3gp',
].join(',');

export function DropBeam({ dragging }: { dragging: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { files } = useCt();

  return (
    <div className="dbeam">
      <div className="section-title">D·BEAM <span className="section-sub">FILE INPUT</span></div>
      <div
        className={`dbeam-window ${dragging ? 'dbeam-hot' : ''} ${files.length === 0 ? 'dbeam-invite' : ''}`}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Add audio files"
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <div className="dbeam-glow" />
        <div className="dbeam-text">
          <div className="dbeam-drop">{dragging ? 'RELEASE!' : 'DROP AUDIO'}</div>
          <div className="dbeam-or">— OR —</div>
          <div className="dbeam-click">CLICK TO LOAD</div>
        </div>
      </div>
      <div className="dbeam-hint">ANY FORMAT · BATCH OK · VIDEO SOUND EXTRACTED</div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
