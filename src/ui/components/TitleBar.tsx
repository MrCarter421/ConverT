// Glossy caption bar — Winamp-skin grip lines, Aero gel caption buttons.

import { IconX } from './Icons';

export function LogoOrb({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="logo-orb" aria-hidden>
      <defs>
        <radialGradient id="orb-body" cx="50%" cy="65%" r="60%">
          <stop offset="0" stopColor="#c8ff6a" />
          <stop offset="0.55" stopColor="#3cc23a" />
          <stop offset="1" stopColor="#0b6b3a" />
        </radialGradient>
        <linearGradient id="orb-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#orb-body)" stroke="#0a5a33" strokeWidth="1" />
      <path d="M9 12.5h8M13 12.5v9M19 21.5l3-9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.95" />
      <ellipse cx="16" cy="9.5" rx="10.5" ry="6.5" fill="url(#orb-gloss)" />
    </svg>
  );
}

export function TitleBar({
  title, id, children, onClose, logo,
}: {
  title: string;
  id?: string;
  children?: React.ReactNode;
  onClose?: () => void;
  logo?: boolean;
}) {
  return (
    <div className="caption">
      {logo && <LogoOrb />}
      <h1 className="caption-title" id={id}>{title}</h1>
      <div className="caption-grip" aria-hidden />
      <div className="caption-btns">
        {children}
        {onClose && (
          <button type="button" className="cap-btn cap-close" onClick={onClose} aria-label="Close" title="Close (Esc)">
            <IconX size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
