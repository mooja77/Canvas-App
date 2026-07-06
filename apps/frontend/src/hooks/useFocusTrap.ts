import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap keyboard focus inside an open dialog (WAI-ARIA dialog pattern / WCAG
 * 2.4.3). `aria-modal="true"` only tells assistive tech the background is inert
 * — it does NOT constrain the physical Tab order, so a sighted keyboard user
 * can Tab straight out of a visible dialog into the page behind it. This hook:
 *   - moves focus into the dialog on open,
 *   - cycles Tab / Shift+Tab within it,
 *   - restores focus to the element that opened the dialog on close.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref);
 *   return <div ref={ref} role="dialog" aria-modal="true">…</div>;
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true): void {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Move focus into the dialog on open (first focusable, else the container).
    const first = focusables()[0];
    if (first) {
      first.focus();
    } else {
      node.setAttribute('tabindex', '-1');
      node.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = els[0];
      const lastEl = els[els.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [ref, active]);
}
