import { zip } from 'fflate';

export function downloadBlob(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** unique "name.ext", "name (2).ext", … */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const count = seen.get(n) ?? 0;
    seen.set(n, count + 1);
    if (count === 0) return n;
    const m = n.match(/^(.*?)(\.[a-z0-9]{1,5})$/i);
    return m ? `${m[1]} (${count + 1})${m[2]}` : `${n} (${count + 1})`;
  });
}

/** Zip a set of already-compressed audio files (store, no re-compression). */
export async function zipFiles(
  entries: { name: string; url: string }[],
): Promise<Blob> {
  const names = uniqueNames(entries.map((e) => e.name));
  const payload: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (let i = 0; i < entries.length; i++) {
    const buf = await fetch(entries[i].url).then((r) => r.arrayBuffer());
    payload[names[i]] = [new Uint8Array(buf), { level: 0 }];
  }
  const data = await new Promise<Uint8Array>((resolve, reject) => {
    zip(payload, (err, out) => (err ? reject(err) : resolve(out)));
  });
  return new Blob([data as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}
