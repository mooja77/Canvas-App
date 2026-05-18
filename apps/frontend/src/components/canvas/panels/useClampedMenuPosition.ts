import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Keeps a fixed-position context menu inside the viewport.
 *
 * The canvas context menus (node/canvas/edge) render `position: fixed` at the
 * raw right-click coordinates. Near the bottom or right edge of the screen the
 * menu — which can be ~350px tall — would otherwise clip off-screen, leaving
 * items like "Delete" unreachable. This hook measures the rendered menu and
 * shifts it back so it always fits, re-clamping if the menu grows (e.g. when an
 * inline section expands) via a ResizeObserver.
 *
 * Returns the clamped {x, y}; feed it to the menu's `style.left` / `style.top`.
 */
export function useClampedMenuPosition(
  ref: RefObject<HTMLElement | null>,
  x: number,
  y: number,
  pad = 8,
): { x: number; y: number } {
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const clamp = () => {
      const rect = el.getBoundingClientRect();
      setPos({
        x: Math.max(pad, Math.min(x, window.innerWidth - rect.width - pad)),
        y: Math.max(pad, Math.min(y, window.innerHeight - rect.height - pad)),
      });
    };
    clamp();
    const ro = new ResizeObserver(clamp);
    ro.observe(el);
    window.addEventListener('resize', clamp);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', clamp);
    };
  }, [ref, x, y, pad]);

  return pos;
}
