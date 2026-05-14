import { ReactNode } from 'react';

interface CTAStripeProps {
  eyebrow?: ReactNode;
  headline: ReactNode;
  sub?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  className?: string;
}

/**
 * Full-bleed ink-background CTA section. Used at the bottom of `/`,
 * `/customers/[slug]`, `/for-teams`, etc. per docs/refresh/04 §4.7.
 *
 * Caller supplies the primary CTA element (button or Link with onClick
 * already wired so the analytics fire from the correct surface).
 */
export default function CTAStripe({ eyebrow, headline, sub, primary, secondary, className = '' }: CTAStripeProps) {
  return (
    <section
      className={`
        bg-ink-900 dark:bg-ink-950
        text-gray-100
        py-16 sm:py-20
        ${className}
      `}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        {eyebrow && (
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-ochre-300 mb-4">{eyebrow}</div>
        )}
        <h2
          className="font-display text-3xl sm:text-4xl lg:text-5xl leading-tight text-white mb-4"
          style={{
            fontFeatureSettings: '"ss01", "ss02"',
            fontVariationSettings: "'opsz' 96, 'wght' 560",
          }}
        >
          {headline}
        </h2>
        {sub && <p className="text-lg text-gray-300 mb-8 max-w-xl mx-auto">{sub}</p>}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {primary}
          {secondary}
        </div>
      </div>
    </section>
  );
}
