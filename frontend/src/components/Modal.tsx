import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

// Open modals, the last one is on top: only it answers the keyboard
const stack: object[] = [];
// The page scroll is locked while any modal is open, and restored once the last one closes
let scrollBefore = '';

/**
 * Modal dialog in a portal. jsdom has no showModal(), and we want the same behaviour everywhere:
 * Escape and a click on the backdrop close it, Tab stays inside, and the focus goes back to where it was.
 */
export default function Modal({
  title,
  onClose,
  role = 'dialog',
  children,
}: {
  title: string;
  onClose: () => void;
  role?: 'dialog' | 'alertdialog';
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const token = useRef({});
  // The close handler changes at each render: the effect below must not restart for it
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const items = () =>
      Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (
      panel.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      items()[0] ??
      panel.current
    )?.focus();

    const me = token.current;
    if (stack.length === 0) {
      scrollBefore = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    stack.push(me);

    function onKeyDown(event: KeyboardEvent) {
      if (stack[stack.length - 1] !== me) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        close.current();
      } else if (event.key === 'Tab') {
        const focusable = items();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      stack.splice(stack.indexOf(me), 1);
      if (stack.length === 0) document.body.style.overflow = scrollBefore;
      before?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        aria-hidden="true"
        className="modal-backdrop absolute inset-0 bg-ink/45"
        onClick={() => onClose()}
      />
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="modal-panel relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl outline-none"
      >
        <h2 id={titleId} className="text-xl font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
