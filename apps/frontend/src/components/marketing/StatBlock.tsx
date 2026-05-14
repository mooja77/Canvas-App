import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface StatBlockProps {
  number: string | number;
  label: string;
  /** When `number` is numeric, count up to it on enter-viewport. Skipped under reduced-motion. */
  animateCountUp?: boolean;
  className?: string;
}

/**
 * Large Fraunces numeral + Inter caption — used on /customers/[slug] and
 * /methodology overview per docs/refresh/04 §4.4 motion moment #2 + §4.7.
 *
 * Count-up animation only fires when `number` is numeric and reduced-motion
 * is off. String numbers like "κ = 0.84" or "6 weeks" render statically.
 */
export default function StatBlock({ number, label, animateCountUp = true, className = '' }: StatBlockProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [displayed, setDisplayed] = useState<string>(() => String(number));

  const numericTarget = typeof number === 'number' ? number : null;
  const shouldAnimate = !reduced && animateCountUp && numericTarget !== null;

  useEffect(() => {
    if (!shouldAnimate || numericTarget === null) {
      setDisplayed(String(number));
      return;
    }
    // jsdom / older browsers may lack IntersectionObserver. Render the
    // final value immediately and skip the count-up animation.
    if (typeof IntersectionObserver === 'undefined') {
      setDisplayed(numericTarget.toLocaleString());
      return;
    }

    setDisplayed('0');
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let started = false;
    const start = performance.now();
    const duration = 900;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(eased * numericTarget).toLocaleString());
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !started) {
            started = true;
            raf = requestAnimationFrame(tick);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [shouldAnimate, numericTarget, number]);

  return (
    <div ref={ref} className={`flex flex-col gap-2 ${className}`}>
      <div
        className="font-display text-[56px] sm:text-[72px] lg:text-[88px] leading-none text-gray-900 dark:text-white tracking-[-0.02em]"
        style={{
          fontFeatureSettings: '"ss01", "ss02"',
          fontVariationSettings: "'opsz' 144, 'wght' 540",
        }}
      >
        {displayed}
      </div>
      <div className="text-xs sm:text-sm font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
        {label}
      </div>
    </div>
  );
}
