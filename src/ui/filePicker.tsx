// The one hidden <input type=file> — any button can summon it.

import { useEffect, useRef } from 'react';
import { addFiles } from '../state/store';

export const ACCEPT = [
  'audio/*', 'video/*',
  '.wav', '.mp3', '.flac', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.alac',
  '.aiff', '.aif', '.wma', '.wv', '.ape', '.mpc', '.tta', '.ac3', '.dts',
  '.amr', '.au', '.caf', '.mka', '.webm', '.mp4', '.mov', '.mkv', '.avi', '.m4b', '.3gp',
].join(',');

let input: HTMLInputElement | null = null;

export function openFilePicker() {
  input?.click();
}

export function FileInput() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input = ref.current;
    return () => { input = null; };
  }, []);
  return (
    <input
      ref={ref}
      type="file"
      multiple
      accept={ACCEPT}
      hidden
      onChange={(e) => {
        if (e.target.files?.length) addFiles(e.target.files);
        e.target.value = '';
      }}
    />
  );
}
