export function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

export function fmtDur(sec?: number): string {
  if (sec === undefined || !Number.isFinite(sec)) return '--:--';
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export function fmtRate(hz?: number): string {
  if (!hz) return '?';
  const k = hz / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
}

export function fmtDepth(d?: number | 'float' | '32f' | null): string {
  if (d === undefined || d === null) return '?';
  if (d === 'float' || d === '32f') return '32F';
  return `${d}B`;
}

export function fmtChannels(c?: number): string {
  if (!c) return '?';
  return c === 1 ? 'MONO' : c === 2 ? 'ST' : `${c}CH`;
}

export function baseName(name: string): string {
  const stripped = name.replace(/\.[a-z0-9]{1,5}$/i, '');
  return stripped || 'convert';
}
