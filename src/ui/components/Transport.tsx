// Transport cluster: the big round hardware buttons.

import {
  clearAll, clearDone, downloadAll, startBatch, stopBatch, toggleTrip, useCt,
} from '../../state/store';

function Round({
  label, icon, className = '', onClick, disabled, led,
}: {
  label: string;
  icon: React.ReactNode;
  className?: string;
  onClick: () => void;
  disabled?: boolean;
  led?: 'green' | 'red' | 'amber' | 'off';
}) {
  return (
    <div className={`tbtn-wrap ${className}`}>
      {led !== undefined && <span className={`led tbtn-led led-${led === 'off' ? 'off' : led}`} />}
      <button type="button" className="tbtn" onClick={onClick} disabled={disabled} aria-label={label}>
        <span className="tbtn-icon">{icon}</span>
      </button>
      <div className="tbtn-label">{label}</div>
    </div>
  );
}

export function Transport() {
  const s = useCt();
  const ready = s.engineState === 'ready';
  const convertible = s.files.some((f) => f.status === 'ready' || f.status === 'error');
  const downloadable = s.files.some((f) => f.status === 'done');

  return (
    <div className="transport">
      <div className="section-title">TRANSPORT <span className="section-sub">CONVERSION CONTROL</span></div>
      <div className="transport-main">
        <Round
          label="CONVERT"
          className="tbtn-big"
          icon={<svg width="26" height="26" viewBox="0 0 24 24"><path d="M6 4 L20 12 L6 20 Z" fill="currentColor" /></svg>}
          onClick={() => void startBatch()}
          disabled={!ready || s.running || !convertible}
          led={s.running ? 'green' : convertible && ready ? 'amber' : 'off'}
        />
        <Round
          label="STOP"
          icon={<svg width="20" height="20" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" fill="currentColor" /></svg>}
          onClick={() => void stopBatch()}
          disabled={!s.running}
          led={s.running ? 'red' : 'off'}
        />
        <Round
          label="GET ALL"
          icon={<svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 3 v11 M6 9 l6 6 6-6 M4 20 h16" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          onClick={() => void downloadAll()}
          disabled={!downloadable}
          led={downloadable ? 'green' : 'off'}
        />
      </div>
      <div className="transport-small">
        <button type="button" className="mini-btn" onClick={clearDone} disabled={s.running || !downloadable}>
          CLR DONE
        </button>
        <button type="button" className="mini-btn" onClick={clearAll} disabled={s.running || s.files.length === 0}>
          CLR ALL
        </button>
        <button
          type="button"
          className={`mini-btn trip-btn ${s.trip ? 'trip-on' : ''}`}
          onClick={toggleTrip}
          aria-pressed={s.trip}
        >
          TRIP
        </button>
      </div>
    </div>
  );
}
