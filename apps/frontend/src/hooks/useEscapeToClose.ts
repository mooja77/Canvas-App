import { useEffect } from 'react';

/**
 * Shared hook: dismiss a dialog/panel when the user presses Esc.
 *
 * Sprint 1C added `role="dialog"` + `aria-modal="true"` + named Close buttons
 * to most canvas modals, but Esc-to-close was not part of that contract. WAI-
 * ARIA dialogs are expected to dismiss on Esc, and screen-reader / keyboard
 * users routinely rely on it.
 *
 * Usage:
 *   export default function MyModal({ onClose }: { onClose: () => void }) {
 *     useEscapeToClose(onClose);
 *     return <div role="dialog" aria-modal="true">...</div>;
 *   }
 *
 * The listener is attached to `window` so it fires regardless of where focus
 * sits (modal body, an input inside the modal, the backdrop). The `e.key ===
 * 'Escape'` check is the canonical way to detect the dismiss key — `keyCode`
 * is deprecated.
 *
 * If multiple modals using this hook are open simultaneously, all of them will
 * close on a single Esc press. That is acceptable because the app does not
 * intentionally stack modals; if a future flow requires nesting, the topmost
 * modal can adopt focus-trap + capture-phase stopPropagation locally.
 */
export function useEscapeToClose(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}
