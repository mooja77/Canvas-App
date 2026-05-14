import { ReactNode } from 'react';

interface PullQuoteProps {
  children: ReactNode;
  attribution?: ReactNode;
  className?: string;
}

/**
 * Editorial pull quote — Fraunces italic, ochre vertical rule on the left,
 * attribution in Inter small caps below. Used in /methodology chapters and
 * customer stories per docs/refresh/04 §4.7.
 */
export default function PullQuote({ children, attribution, className = '' }: PullQuoteProps) {
  return (
    <figure className={`my-12 ${className}`}>
      <blockquote className="border-l-2 border-ochre-500 pl-6 sm:pl-8">
        <p
          className="font-display italic text-[22px] sm:text-[28px] leading-[1.4] text-gray-900 dark:text-white"
          style={{
            fontFeatureSettings: '"ss01", "ss02"',
            fontVariationSettings: "'wght' 500",
            letterSpacing: '-0.005em',
          }}
        >
          {children}
        </p>
        {attribution && (
          <figcaption className="mt-4 text-sm font-medium uppercase tracking-[0.06em] text-gray-500 dark:text-gray-400">
            — {attribution}
          </figcaption>
        )}
      </blockquote>
    </figure>
  );
}
