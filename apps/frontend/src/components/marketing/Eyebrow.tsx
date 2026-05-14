import { ReactNode } from 'react';

/**
 * Eyebrow — tracked-caps label above an H1 or section heading.
 *
 * Per docs/refresh/04 §4.2 type ramp: Inter 13/12px, weight 600, tracking +8%.
 * Sits above the ochre HairlineRule in most sections.
 */
export default function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`text-[13px] sm:text-[13px] font-semibold uppercase tracking-[0.08em] leading-tight text-gray-600 dark:text-gray-400 ${className}`}
    >
      {children}
    </div>
  );
}
