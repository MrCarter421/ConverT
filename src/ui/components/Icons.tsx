// Tiny inline SVG icon set. Stroke icons inherit currentColor.

type P = { size?: number; className?: string };

const S = ({ size = 16, className, children, fill = 'none' }: P & { children: React.ReactNode; fill?: string }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden
    fill={fill} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const IconPlay = (p: P) => <S {...p} fill="currentColor"><path d="M7 4.5v15l12.5-7.5z" stroke="none" /></S>;
export const IconStop = (p: P) => <S {...p} fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" stroke="none" /></S>;
export const IconCheck = (p: P) => <S {...p}><path d="M4.5 12.5l5 5L19.5 7" /></S>;
export const IconDown = (p: P) => <S {...p}><path d="M12 4v11M6.5 10l5.5 5.5L17.5 10M5 20h14" /></S>;
export const IconPlus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IconX = (p: P) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>;
export const IconChevron = (p: P) => <S {...p}><path d="M6 9l6 6 6-6" /></S>;
export const IconGear = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5" />
  </S>
);
export const IconHelp = (p: P) => (
  <S {...p}>
    <path d="M9.2 9.2a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2 1-1.2 1.9v.4" />
    <circle cx="12" cy="17.6" r="0.6" fill="currentColor" />
  </S>
);
export const IconEject = (p: P) => (
  <S {...p} fill="currentColor"><path d="M12 5l7 8H5z M5 16.5h14v2.5H5z" stroke="none" /></S>
);
export const IconTrash = (p: P) => (
  <S {...p}><path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 12.5h9l1-12.5" /></S>
);
export const IconSave = (p: P) => (
  <S {...p}><path d="M5 4h11l3 3v13H5z M8.5 4v5h6V4 M8 20v-6h8v6" /></S>
);
