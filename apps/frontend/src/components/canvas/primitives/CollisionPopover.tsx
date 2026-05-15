import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMobile } from '../../../hooks/useMobile';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

/**
 * Collision-aware popover used by the canvas toolbar's dropdowns and the
 * AddComputedNodeMenu. Replaces the hand-rolled `absolute right-0 top-full`
 * dropdown that clipped off the viewport at narrow widths (live QA findings
 * #13, #19, #20).
 *
 * Desktop + tablet: floating popover anchored to the trigger. If the natural
 * placement (right-aligned, below trigger) would extend past the right or
 * bottom viewport edges, the popover slides left and/or flips above. The math
 * runs after first paint via useLayoutEffect on the rendered popover bbox.
 *
 * Mobile (`useMobile()` returns true): bottom-sheet variant. Full width,
 * anchored to viewport bottom, slide-up entrance. Honors prefers-reduced-motion
 * by skipping the transform transition.
 *
 * Open state is owned by the parent — this primitive is purely a positioned
 * surface. Escape-to-close + outside-click-to-close are handled here so each
 * call site doesn't reinvent them.
 */

interface CollisionPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Accessible role applied to the surface. Defaults to "menu" since toolbar
   * dropdowns are the primary consumer. Other call sites can pass "dialog". */
  role?: 'menu' | 'dialog';
  /** Width of the desktop popover. Mobile bottom-sheet ignores this. */
  width?: number;
  /** Optional className applied to the popover surface in addition to the
   * shared chrome (rounded, shadow, ring). */
  className?: string;
  children: React.ReactNode;
}

const VIEWPORT_PAD = 8;

export function CollisionPopover({
  open,
  onClose,
  anchorRef,
  role = 'menu',
  width = 224,
  className,
  children,
}: CollisionPopoverProps) {
  const isMobile = useMobile();
  const reducedMotion = useReducedMotion();
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Computed style for the desktop variant. Recomputed every open via
  // useLayoutEffect once the popover has dimensions.
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    placement: 'below' | 'above';
  } | null>(null);

  // Escape + outside-click handlers (shared across desktop/mobile).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, onClose, anchorRef]);

  // Desktop position math. Anchored to trigger's bbox. Right-aligned by
  // default; flips left if it would clip the right viewport edge. Below by
  // default; flips above if it would clip the bottom edge.
  useLayoutEffect(() => {
    if (!open || isMobile) {
      setPosition(null);
      return;
    }
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;

    const aRect = anchor.getBoundingClientRect();
    const pRect = popover.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: right-align to the trigger's right edge.
    let left = aRect.right - pRect.width;
    if (left + pRect.width > vw - VIEWPORT_PAD) {
      left = vw - VIEWPORT_PAD - pRect.width;
    }
    if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;

    // Vertical: prefer below trigger. Flip if it would extend past bottom.
    let top = aRect.bottom + 4;
    let placement: 'below' | 'above' = 'below';
    if (top + pRect.height > vh - VIEWPORT_PAD && aRect.top - pRect.height - 4 > VIEWPORT_PAD) {
      top = aRect.top - pRect.height - 4;
      placement = 'above';
    } else if (top + pRect.height > vh - VIEWPORT_PAD) {
      // Neither below nor above fits cleanly — clamp to viewport bottom.
      top = vh - VIEWPORT_PAD - pRect.height;
    }

    setPosition({ left, top, placement });
  }, [open, isMobile, anchorRef]);

  if (!open) return null;

  if (isMobile) {
    return createPortal(
      <>
        <div
          className={'fixed inset-0 z-[100]' + (reducedMotion ? '' : ' transition-opacity duration-150')}
          style={{ background: 'rgba(15, 17, 23, 0.4)' }}
          onClick={onClose}
        />
        <div
          ref={popoverRef}
          role={role}
          aria-modal={role === 'dialog' ? 'true' : undefined}
          className={
            'fixed left-0 right-0 bottom-0 z-[101] max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white px-1 py-2 shadow-2xl dark:bg-gray-800' +
            (reducedMotion ? '' : ' animate-slide-up') +
            (className ? ' ' + className : '')
          }
        >
          <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
          {children}
        </div>
      </>,
      document.body,
    );
  }

  // Desktop: portal so position is relative to viewport, not the toolbar
  // container (which can have its own transform/overflow stacking issues).
  const style: React.CSSProperties = {
    position: 'fixed',
    left: position?.left ?? -9999,
    top: position?.top ?? -9999,
    width,
    visibility: position ? 'visible' : 'hidden',
    maxHeight: `calc(100vh - ${VIEWPORT_PAD * 2}px)`,
    overflowY: 'auto',
    zIndex: 100,
  };

  return createPortal(
    <div
      ref={popoverRef}
      role={role}
      aria-modal={role === 'dialog' ? 'true' : undefined}
      className={
        'rounded-xl bg-white py-1.5 shadow-xl ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700' +
        (className ? ' ' + className : '')
      }
      style={style}
    >
      {children}
    </div>,
    document.body,
  );
}
