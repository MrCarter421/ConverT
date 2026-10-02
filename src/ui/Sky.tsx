// The Frutiger Aero desktop: sky gradient, sun glare, drifting clouds, light
// ribbons, glossy hills and rising bubbles. Colors come from skin tokens.

// deterministic "random" bubbles so the layout never jumps between renders
const BUBBLES = Array.from({ length: 16 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 9301 + n * 49297) + 1) / 2);
  return {
    left: `${Math.round(r(1) * 96)}%`,
    size: Math.round(14 + r(2) * 56),
    dur: `${Math.round(16 + r(3) * 22)}s`,
    delay: `-${Math.round(r(4) * 30)}s`,
    sway: `${Math.round(r(5) * 60 - 30)}px`,
  };
});

export function Sky() {
  return (
    <div className="sky" aria-hidden>
      <div className="sky-stars" />
      <div className="sky-sun" />
      <div className="sky-cloud c1" />
      <div className="sky-cloud c2" />
      <div className="sky-cloud c3" />
      <svg className="sky-ribbons" viewBox="0 0 1440 900" preserveAspectRatio="none">
        <defs>
          <linearGradient id="rib-a" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" className="rib-stop-0" />
            <stop offset="0.45" className="rib-stop-a" />
            <stop offset="1" className="rib-stop-0" />
          </linearGradient>
          <linearGradient id="rib-b" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" className="rib-stop-0" />
            <stop offset="0.6" className="rib-stop-b" />
            <stop offset="1" className="rib-stop-0" />
          </linearGradient>
        </defs>
        <path className="rib-band" d="M-50 620 C 300 470, 620 700, 980 520 S 1400 380, 1500 430 L 1500 560 C 1300 520, 1100 640, 860 660 S 300 640, -50 760 Z" fill="url(#rib-b)" />
        <path className="rib-line" d="M-50 600 C 320 450, 640 690, 1000 500 S 1380 360, 1500 410" stroke="url(#rib-a)" />
        <path className="rib-line" d="M-50 640 C 340 500, 660 720, 1010 540 S 1390 410, 1500 450" stroke="url(#rib-a)" />
        <path className="rib-line thin" d="M-50 680 C 360 540, 700 740, 1030 575 S 1400 450, 1500 490" stroke="url(#rib-a)" />
      </svg>
      <svg className="sky-hills" viewBox="0 0 1440 260" preserveAspectRatio="none">
        <defs>
          <linearGradient id="hill-back" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" className="hill-stop-0" />
            <stop offset="1" className="hill-stop-1" />
          </linearGradient>
          <linearGradient id="hill-front" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" className="hill-stop-1" />
            <stop offset="1" className="hill-stop-2" />
          </linearGradient>
        </defs>
        <path d="M0 150 C 240 60, 520 70, 760 130 S 1200 90, 1440 120 L 1440 260 L 0 260 Z" fill="url(#hill-back)" opacity="0.85" />
        <path d="M0 210 C 300 120, 640 150, 900 190 S 1300 160, 1440 175 L 1440 260 L 0 260 Z" fill="url(#hill-front)" />
        <path className="hill-shine" d="M0 210 C 300 120, 640 150, 900 190 S 1300 160, 1440 175" />
      </svg>
      <div className="bubbles">
        {BUBBLES.map((b, i) => (
          <i
            key={i}
            style={{
              left: b.left, width: b.size, height: b.size,
              animationDuration: b.dur, animationDelay: b.delay,
              ['--sway' as string]: b.sway,
            }}
          />
        ))}
      </div>
    </div>
  );
}
