import { useEffect, useState } from 'react';

/**
 * Boolean from matchMedia('(prefers-reduced-motion: reduce)'). Updates live
 * when the OS preference changes. Used by motion-using primitives
 * (StatBlock count-up, HairlineRule draw-in, DisplayHeading word-stagger,
 * etc.) per docs/refresh/04 §4.4.
 *
 * Returns `false` during SSR / no-window so animation is the default on
 * cold-paint; the hook then re-evaluates after hydration.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}
