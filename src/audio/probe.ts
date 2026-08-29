// ─── ConverT CT-505 · input analyzer ─────────────────────────────────────────
// Parses `ffmpeg -i` stderr into a ProbeInfo. Works for anything the decoder
// can open — including video containers, whose audio we happily extract.

import type { ProbeInfo } from '../types';
import { isLosslessCodec } from './formats';

const TAG_KEYS = new Set([
  'title', 'artist', 'album', 'album_artist', 'date', 'year', 'genre',
  'track', 'composer', 'comment', 'disc',
]);

export function parseProbe(logs: string[]): ProbeInfo {
  const info: ProbeInfo = {
    lossless: false,
    hasCoverArt: false,
    isVideo: false,
    tags: {},
  };

  for (const raw of logs) {
    const line = raw.replace(/\r/g, '');

    const input = line.match(/Input #0,\s*([^,]+),/);
    if (input) info.container = input[1].trim();

    const dur = line.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (dur) {
      info.durationSec = (+dur[1]) * 3600 + (+dur[2]) * 60 + parseFloat(dur[3]);
    }

    const audio = line.match(/Stream #\d+:\d+.*?:\s*Audio:\s*(.+)/);
    if (audio && info.codec === undefined) {
      const body = audio[1];
      info.codec = body.split(/[\s,(]/)[0].toLowerCase();

      const hz = body.match(/(\d+)\s*Hz/);
      if (hz) info.sampleRate = +hz[1];

      if (/\bmono\b/.test(body)) info.channels = 1;
      else if (/\bstereo\b/.test(body)) info.channels = 2;
      else {
        const ch = body.match(/(\d+)(?:\.(\d+))?\s*channels/) ?? body.match(/,\s*(\d)\.(\d)\b/);
        if (ch) info.channels = (+ch[1]) + (ch[2] ? +ch[2] : 0);
        else if (/\bquad\b/.test(body)) info.channels = 4;
      }

      const explicitBits = body.match(/\((\d+)\s*bit\)/);
      if (explicitBits) info.bitDepth = +explicitBits[1];
      else {
        const fmtTok = body.match(/,\s*(u8p?|s16p?|s32p?|s64p?|fltp?|dblp?)\b/);
        if (fmtTok) {
          const f = fmtTok[1];
          if (f.startsWith('u8')) info.bitDepth = 8;
          else if (f.startsWith('s16')) info.bitDepth = 16;
          else if (f.startsWith('s32')) info.bitDepth = 32;
          else if (f.startsWith('s64')) info.bitDepth = 32;
          else info.bitDepth = 'float';
        }
      }

      const kb = body.match(/(\d+)\s*kb\/s/);
      if (kb) info.bitrateKbps = +kb[1];

      info.lossless = isLosslessCodec(info.codec);
    }

    const video = line.match(/Stream #\d+:\d+.*?:\s*Video:\s*(.+)/);
    if (video) {
      if (/attached pic/.test(video[1]) || /attached pic/.test(line)) {
        info.hasCoverArt = true;
      } else {
        // real motion video (ignore stills mislabeled by some muxers)
        const codec = video[1].split(/[\s,(]/)[0].toLowerCase();
        if (!['mjpeg', 'png', 'bmp', 'gif'].includes(codec)) info.isVideo = true;
        else info.hasCoverArt = true;
      }
    }

    const tag = line.match(/^\s{4,}(\w[\w ]*?)\s*:\s(.+)$/);
    if (tag) {
      const key = tag[1].trim().toLowerCase().replace(/ /g, '_');
      if (TAG_KEYS.has(key) && !(key in info.tags)) info.tags[key] = tag[2].trim();
    }
  }

  return info;
}
