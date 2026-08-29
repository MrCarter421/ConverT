import { useEffect, useState } from 'react';
import { Faceplate } from './ui/Faceplate';
import {
  addFiles, bootEngine, removeFile, stepFile, stopBatch, useCt,
} from './state/store';

const DESIGN_W = 1280;

function usePlateScale(): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(1, (window.innerWidth - 16) / DESIGN_W));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}

function PsyBackground({ trip }: { trip: boolean }) {
  return (
    <div className={`psy ${trip ? 'psy-trip' : ''}`} aria-hidden>
      <div className="psy-blob psy-b1" />
      <div className="psy-blob psy-b2" />
      <div className="psy-blob psy-b3" />
      <div className="psy-blob psy-b4" />
      <div className="psy-blob psy-b5" />
      <div className="psy-swirl" />
      <div className="psy-grain" />
    </div>
  );
}

export default function App() {
  const trip = useCt((s) => s.trip);
  const running = useCt((s) => s.running);
  const selectedId = useCt((s) => s.selectedId);
  const [dragging, setDragging] = useState(false);
  const scale = usePlateScale();

  useEffect(() => {
    void bootEngine();
  }, []);

  // whole-window drag & drop
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      depth += 1;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      addFiles(e.dataTransfer.files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  // hardware-ish keyboard control
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
      if (e.key === 'Escape' && running) void stopBatch();
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && el.tagName !== 'BUTTON' && !el.classList.contains('pad')) {
        removeFile(selectedId);
      }
      if (e.key === 'ArrowRight' && el.tagName === 'BODY') stepFile(1);
      if (e.key === 'ArrowLeft' && el.tagName === 'BODY') stepFile(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, selectedId]);

  return (
    <div className={`app ${trip ? 'app-trip' : ''}`}>
      <PsyBackground trip={trip} />
      <div className="stage-clamp" style={{ height: `calc(${scale} * var(--plate-h, 980px))` }}>
        <div className="stage" style={{ transform: `scale(${scale})` }}>
          <Faceplate dragging={dragging} />
        </div>
      </div>
    </div>
  );
}
