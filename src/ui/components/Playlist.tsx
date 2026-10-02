// The playlist: your files, Winamp-numbered. Empty, it becomes the drop bubble.

import { useEffect, useRef } from 'react';
import {
  clearAll, downloadAll, downloadOne, removeFile, toggleSelect, useCt,
} from '../../state/store';
import { engine } from '../../audio/engine/ffmpegEngine';
import { fmtBytes, fmtChannels, fmtDepth, fmtDur, fmtRate } from '../../util/fmt';
import type { FileEntry, Preset, ProbeInfo } from '../../types';
import { openFilePicker } from '../filePicker';
import { IconDown, IconPlus, IconX } from './Icons';

function DropZone() {
  const booting = useCt((s) => s.engineState !== 'ready');
  return (
    <button type="button" className="dropzone" onClick={openFilePicker}>
      <span className="drop-orb" aria-hidden>
        <IconDown size={30} />
      </span>
      <span className="drop-title">Drop audio files here</span>
      <span className="drop-sub">
        or click to browse · any format, even video{booting ? ' · engine warming up' : ''}
      </span>
    </button>
  );
}

const srcLine = (p: ProbeInfo) =>
  [
    (p.codec ?? '?').toUpperCase(),
    p.sampleRate ? `${fmtRate(p.sampleRate).replace('K', '')} kHz` : null,
    typeof p.bitDepth === 'number' ? `${p.bitDepth}-bit` : p.bitDepth === 'float' ? 'float' : null,
    fmtChannels(p.channels).replace('ST', 'stereo').replace('MONO', 'mono'),
    p.bitrateKbps ? `${p.bitrateKbps} kbps` : null,
  ].filter(Boolean).join(' · ');

function Details({ f, edit }: { f: FileEntry; edit: Preset }) {
  const p = f.probe;
  const plan = engine.plan(edit, p);
  const tags = p ? [p.tags.artist, p.tags.title, p.tags.album].filter(Boolean).join(' – ') : '';
  const e = plan.effective;
  const out = [
    plan.format.knob,
    `${fmtRate(e.rate).replace('K', '')} kHz`,
    e.depth ? `${fmtDepth(e.depth).replace('B', '-bit').replace('32F', '32-bit float')}` : null,
    e.channels === 1 ? 'mono' : e.channels === 2 ? 'stereo' : `${e.channels} ch`,
  ].filter(Boolean).join(' · ');
  return (
    <div className="pl-details">
      <dl>
        <dt>Source</dt>
        <dd>{p ? srcLine(p) : f.status === 'probing' ? 'reading…' : 'unreadable'}{p?.durationSec ? ` · ${fmtDur(p.durationSec)}` : ''} · {fmtBytes(f.size)}</dd>
        {tags && (<><dt>Tags</dt><dd>{tags}</dd></>)}
        <dt>Output</dt>
        <dd>{out}{plan.withArt ? ' · cover art kept' : ''}</dd>
        {f.result && (<><dt>Saved</dt><dd>{f.result.outName} · {fmtBytes(f.result.size)} · {(f.result.elapsedMs / 1000).toFixed(1)} s</dd></>)}
        {f.error && (<><dt>Error</dt><dd className="pl-err">{f.error}</dd></>)}
      </dl>
      {plan.badges.length > 0 && (
        <div className="pl-badges">
          {(f.result?.badges ?? plan.badges).map((b) => <span key={b}>{b}</span>)}
        </div>
      )}
    </div>
  );
}

function meta(f: FileEntry): string {
  switch (f.status) {
    case 'probing': return 'reading…';
    case 'queued': return 'queued';
    case 'converting': return f.phase === 'analyze' ? 'measuring' : `${Math.round(f.progress * 100)}%`;
    case 'done': return f.result ? fmtBytes(f.result.size) : 'done';
    case 'error': return 'failed';
    default: return fmtDur(f.probe?.durationSec);
  }
}

export function Playlist() {
  const files = useCt((s) => s.files);
  const selectedId = useCt((s) => s.selectedId);
  const running = useCt((s) => s.running);
  const edit = useCt((s) => s.edit);
  const listRef = useRef<HTMLOListElement>(null);
  const convertingId = files.find((f) => f.status === 'converting')?.id;

  // keep the active row in view during long batches
  useEffect(() => {
    if (!convertingId) return;
    listRef.current?.querySelector(`[data-id="${convertingId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [convertingId]);

  if (!files.length) return <div className="playlist is-empty"><DropZone /></div>;

  const done = files.filter((f) => f.status === 'done').length;

  return (
    <div className="playlist">
      <ol className="pl-list" ref={listRef} aria-label="Files">
        {files.map((f, i) => {
          const open = f.id === selectedId;
          return (
            <li key={f.id} data-id={f.id} className={`pl-row is-${f.status} ${open ? 'is-open' : ''}`}>
              <div className="pl-main">
                <button
                  type="button"
                  className="pl-hit"
                  onClick={() => toggleSelect(f.id)}
                  aria-expanded={open}
                  title={f.name}
                  onKeyDown={(e) => { if (e.key === 'Delete') removeFile(f.id); }}
                >
                  <span className={`pl-dot is-${f.status}`} aria-hidden />
                  <span className="pl-num">{i + 1}.</span>
                  <span className="pl-name">{f.name}</span>
                  <span className="pl-meta">{meta(f)}</span>
                </button>
                {f.status === 'done' && (
                  <button type="button" className="pl-act is-dl" onClick={() => downloadOne(f.id)} aria-label={`Download ${f.result?.outName ?? f.name}`} title="Download">
                    <IconDown size={15} />
                  </button>
                )}
                {f.status !== 'converting' && f.status !== 'queued' && (
                  <button type="button" className="pl-act" onClick={() => removeFile(f.id)} aria-label={`Remove ${f.name}`} title="Remove">
                    <IconX size={13} />
                  </button>
                )}
              </div>
              {f.status === 'converting' && (
                <div className="pl-progress"><i style={{ width: `${f.progress * 100}%` }} /></div>
              )}
              {open && <Details f={f} edit={edit} />}
            </li>
          );
        })}
      </ol>
      <div className="pl-foot">
        <button type="button" className="pl-link" onClick={openFilePicker}>
          <IconPlus size={13} /> Add
        </button>
        <span className="pl-count">
          {files.length} file{files.length === 1 ? '' : 's'}{done ? ` · ${done} done` : ''}
        </span>
        {done > 1 && (
          <button type="button" className="pl-link" onClick={() => void downloadAll()}>
            <IconDown size={13} /> Save all
          </button>
        )}
        <button type="button" className="pl-link" onClick={clearAll} disabled={running}>
          Clear
        </button>
      </div>
    </div>
  );
}
