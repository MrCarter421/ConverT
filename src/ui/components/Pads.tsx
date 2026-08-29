// The 16-pad × 4-bank file queue. Every file lives on a rubber pad.

import {
  PADS_PER_BANK, downloadOne, removeFile, selectFile, setBank, useCt,
} from '../../state/store';
import { fmtBytes, fmtRate } from '../../util/fmt';
import type { FileEntry } from '../../types';

const BANKS = ['A', 'B', 'C', 'D'];

function ledClass(f?: FileEntry): string {
  if (!f) return 'led-off';
  switch (f.status) {
    case 'probing': return 'led-amber led-blink';
    case 'ready': return 'led-green led-dim';
    case 'queued': return 'led-amber';
    case 'converting': return 'led-red led-blink';
    case 'done': return 'led-green';
    case 'error': return 'led-red led-blink-fast';
  }
}

function subline(f: FileEntry): string {
  switch (f.status) {
    case 'probing': return 'READING…';
    case 'converting': return `${Math.round(f.progress * 100)}%`;
    case 'done': return f.result ? `✓ ${fmtBytes(f.result.size)}` : '✓';
    case 'error': return '✕ ERROR';
    case 'queued': return 'QUEUED';
    default: {
      const p = f.probe;
      return p ? `${(p.codec ?? '?').toUpperCase()} ${fmtRate(p.sampleRate)} · ${fmtBytes(f.size)}` : fmtBytes(f.size);
    }
  }
}

export function Pads() {
  const { files, selectedId, bank, running } = useCt();
  const start = bank * PADS_PER_BANK;
  const slots: (FileEntry | undefined)[] = Array.from(
    { length: PADS_PER_BANK },
    (_, i) => files[start + i],
  );

  return (
    <div className="pad-section">
      <div className="bank-col">
        <div className="bank-title">BANK</div>
        {BANKS.map((b, i) => {
          const has = files.length > i * PADS_PER_BANK;
          return (
            <button
              key={b}
              type="button"
              className={`bank-btn ${bank === i ? 'bank-on' : ''}`}
              onClick={() => setBank(i)}
            >
              <span className={`led ${has ? (bank === i ? 'led-orange' : 'led-green led-dim') : 'led-off'}`} />
              {b}
            </button>
          );
        })}
        <div className="bank-count">{files.length}/64</div>
      </div>
      <div className="pad-grid">
        {slots.map((f, i) => {
          const idx = start + i;
          const selected = f && f.id === selectedId;
          return (
            <div
              key={f?.id ?? `empty-${idx}`}
              className={`pad ${f ? `pad-${f.status}` : 'pad-empty'} ${selected ? 'pad-selected' : ''}`}
              onClick={() => f && selectFile(f.id)}
              onDoubleClick={() => f?.status === 'done' && downloadOne(f.id)}
              role={f ? 'button' : undefined}
              tabIndex={f ? 0 : -1}
              onKeyDown={(e) => {
                if (!f) return;
                if (e.key === 'Enter') selectFile(f.id);
                if (e.key === 'Delete' || e.key === 'Backspace') removeFile(f.id);
              }}
            >
              <span className={`led pad-led ${ledClass(f)}`} />
              <span className="pad-num">{String(idx + 1).padStart(2, '0')}</span>
              {f ? (
                <>
                  {!running && f.status !== 'converting' && (
                    <button
                      type="button"
                      className="pad-x"
                      aria-label={`remove ${f.name}`}
                      onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                    >
                      ×
                    </button>
                  )}
                  <div className="pad-name" title={f.name}>{f.name}</div>
                  <div className={`pad-sub pad-sub-${f.status}`}>{subline(f)}</div>
                  {f.status === 'converting' && (
                    <div className="pad-progress"><div style={{ width: `${f.progress * 100}%` }} /></div>
                  )}
                </>
              ) : (
                <div className="pad-ghost">·</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
