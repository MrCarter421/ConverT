import { useEffect, useState } from 'react';
import { Sky } from './ui/Sky';
import { Player } from './ui/Player';
import { PresetWindow } from './ui/popups/PresetWindow';
import { SettingsWindow } from './ui/popups/SettingsWindow';
import { HelpWindow } from './ui/popups/HelpWindow';
import {
  addFiles, bootEngine, closePopup, stopBatch, useCt,
} from './state/store';

const THEME_COLOR = { day: '#1f8fd8', night: '#061a33' } as const;

export default function App() {
  const skin = useCt((s) => s.skin);
  const motion = useCt((s) => s.motion);
  const popup = useCt((s) => s.popup);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    void bootEngine();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.skin = skin;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[skin]);
  }, [skin]);

  // the whole window is a drop target
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'));
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer?.files.length) {
        addFiles(e.dataTransfer.files);
        closePopup();
      }
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

  // Esc: close the pop-up first, otherwise stop a running batch
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (useCt.getState().popup) closePopup();
      else if (useCt.getState().running) void stopBatch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`app ${motion ? '' : 'is-still'}`}>
      <Sky />
      <main className="stage">
        <Player dragging={dragging} />
        <p className="stage-foot">100% local · your audio never leaves this computer</p>
      </main>
      {popup === 'preset' && <PresetWindow />}
      {popup === 'settings' && <SettingsWindow />}
      {popup === 'help' && <HelpWindow />}
    </div>
  );
}
