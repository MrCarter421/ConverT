// Modal pop-up window: same glass skin as the player. Esc / backdrop / × close.

import { useEffect, useId, useRef } from 'react';
import { closePopup } from '../../state/store';
import { TitleBar } from '../components/TitleBar';

export function Window({
  title, className = '', children, footer,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // focus the first real control, not the close button
    const first = ref.current?.querySelector<HTMLElement>(
      '.win-body button:not(:disabled), .win-body [href], .win-body input, .win-body select',
    );
    (first ?? ref.current)?.focus({ preventScroll: true });
    return () => prev?.focus?.({ preventScroll: true });
  }, []);

  // keep Tab inside the window
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) closePopup(); }}>
      <div
        ref={ref}
        className={`win popup ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <TitleBar title={title} id={id} onClose={closePopup} />
        <div className="win-body">{children}</div>
        {footer && <div className="win-foot">{footer}</div>}
      </div>
    </div>
  );
}
