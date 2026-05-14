import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * 1px ochre hairline rule that lives above an H1 or pull quote. Draws in
 * from width: 0 to 48px over 240ms when entering the viewport, via
 * IntersectionObserver. Static under prefers-reduced-motion.
 *
 * Spec: docs/refresh/04 §4.4 motion moment #3.
 */
export default function HairlineRule({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setRevealed(true);
      return;
    }
    // jsdom / older browsers may not have IntersectionObserver — skip the
    // animation and show the rule immediately. The visual difference is
    // negligible (240ms width transition) and the test environment is
    // unaffected.
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`h-[2px] bg-ochre-500 transition-[width] duration-[240ms] ease-out ${className}`}
      style={{ width: revealed ? '48px' : '0px' }}
    />
  );
}
