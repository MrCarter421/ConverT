// Red 7-segment LED readout (the CT-505's little BPM-style display).

const SEGS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc',
  '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
  '-': 'g', ' ': '', 'E': 'afged', 'r': 'eg', 'o': 'cdeg',
  'P': 'abefg', 'F': 'aefg', 'L': 'def', 'd': 'bcdeg', 'n': 'ceg',
};

const W = 30;
const H = 52;
const T = 5; // segment thickness

function hseg(x: number, y: number, w: number): string {
  const h = T / 2;
  return `M${x + 1},${y} L${x + h + 1},${y - h} L${x + w - h - 1},${y - h} L${x + w - 1},${y} L${x + w - h - 1},${y + h} L${x + h + 1},${y + h} Z`;
}
function vseg(x: number, y: number, l: number): string {
  const h = T / 2;
  return `M${x},${y + 1} L${x + h},${y + h + 1} L${x + h},${y + l - h - 1} L${x},${y + l - 1} L${x - h},${y + l - h - 1} L${x - h},${y + h + 1} Z`;
}

const PATHS: Record<string, string> = {
  a: hseg(3, 4, W - 6),
  b: vseg(W - 3, 4, H / 2 - 4),
  c: vseg(W - 3, H / 2, H / 2 - 4),
  d: hseg(3, H - 4, W - 6),
  e: vseg(3, H / 2, H / 2 - 4),
  f: vseg(3, 4, H / 2 - 4),
  g: hseg(3, H / 2, W - 6),
};

export function SevenSeg({ value, digits = 3, label }: { value: string; digits?: number; label?: string }) {
  const chars = value.slice(-digits).padStart(digits, ' ').split('');
  return (
    <div className="seg7">
      <svg
        width={digits * (W + 6) + 10}
        height={H + 10}
        viewBox={`0 0 ${digits * (W + 6) + 10} ${H + 10}`}
        aria-label={label ? `${label}: ${value.trim()}` : value.trim()}
      >
        {chars.map((ch, i) => {
          const on = SEGS[ch] ?? '';
          return (
            <g key={i} transform={`translate(${5 + i * (W + 6)},5) skewX(-4)`}>
              {Object.entries(PATHS).map(([seg, d]) => (
                <path
                  key={seg}
                  d={d}
                  className={on.includes(seg) ? 'seg-on' : 'seg-off'}
                />
              ))}
            </g>
          );
        })}
      </svg>
      {label && <div className="seg7-label">{label}</div>}
    </div>
  );
}
