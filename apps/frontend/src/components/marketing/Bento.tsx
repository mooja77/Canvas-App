import { ReactNode } from 'react';

interface BentoProps {
  children: ReactNode;
  className?: string;
}

interface BentoCellProps {
  span?: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}

/**
 * Asymmetric bento grid used on `/`, `/for-teams`, `/for-institutions` per
 * docs/refresh/04 §4.7. Six-tile alternating 2:1:1 / 1:1:2 pattern is the
 * default; individual cells can override their span via the `span` prop.
 *
 * Single column on mobile.
 */
export function Bento({ children, className = '' }: BentoProps) {
  return <div className={`grid grid-cols-1 sm:grid-cols-4 gap-4 ${className}`}>{children}</div>;
}

const SPAN: Record<1 | 2 | 3, string> = {
  1: 'sm:col-span-1',
  2: 'sm:col-span-2',
  3: 'sm:col-span-3',
};

export function BentoCell({ span = 1, children, className = '' }: BentoCellProps) {
  return (
    <div
      className={`
        ${SPAN[span]}
        rounded-2xl
        p-6 sm:p-8
        bg-white dark:bg-gray-800/60
        ring-1 ring-gray-200 dark:ring-gray-700
        transition-all duration-[180ms] ease-out
        hover:-translate-y-0.5 hover:shadow-lg hover:ring-gray-300 dark:hover:ring-gray-600
        focus-within:ring-2 focus-within:ring-ochre-400 focus-within:ring-offset-2
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export default Bento;
