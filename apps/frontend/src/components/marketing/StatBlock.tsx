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
  // Seed with the real (localized) final value, never a bare String(number).
  // If the count-up never runs — reduced motion, no IntersectionObserver, or
  // the stat is simply never scrolled into view — the honest number stays on
  // screen instead of a misleading "0 Analysis tools".
  const [displayed, setDisplayed] = useState<string>(() =>
    typeof number === 'number' ? number.toLocaleString() : String(number),
  );

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

    const el = ref.current;
    if (!el) return;

    // If the stat is already on-screen at mount, don't reset it to "0" — a
    // count-up the user is already looking at flashes a misleading
    // "0 Analysis tools". Show the real value immediately; the count-up
    // reveal is reserved for stats the user scrolls down into view.
    const rect = el.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight && rect.bottom > 0;
    if (alreadyVisible) {
      setDisplayed(numericTarget.toLocaleString());
      return;
    }

    // NB: we deliberately do NOT reset to "0" here. The zero-and-count-up only
    // happens once the stat actually scrolls into view (in the observer
    // callback below), so a stat that's never reached keeps its real value.

    let raf = 0;
    let started = false;
    let start = 0;
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
            setDisplayed('0');
            start = performance.now();
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
