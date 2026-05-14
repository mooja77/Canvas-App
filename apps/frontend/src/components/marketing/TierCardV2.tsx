import { ReactNode } from 'react';

interface TierCardV2Props {
  name: string;
  price: ReactNode;
  /** Optional annual-price strikethrough or savings line under the price. */
  pricePeriod?: ReactNode;
  audience: string;
  features: string[];
  cta: ReactNode;
  /** Footnote shown below the CTA — useful for "no credit card" or current-plan label. */
  footnote?: ReactNode;
  /** True if this is the user's current plan; surfaces a small badge instead of CTA. */
  isCurrent?: boolean;
  className?: string;
}

/**
 * Pricing tier card per docs/refresh/06-pages/02-pricing.md.
 *
 * Differences from the legacy TierCard:
 *  - No "Most Popular" badge. Equal visual weight across all 4 tiers.
 *  - Audience line below the price (e.g. "For working researchers").
 *  - Features list as plain bullets, no checkmark icons (editorial register).
 *  - CTA passed in as ReactNode so the caller wires Stripe/checkout properly.
 */
export default function TierCardV2({
  name,
  price,
  pricePeriod,
  audience,
  features,
  cta,
  footnote,
  isCurrent,
  className = '',
}: TierCardV2Props) {
  return (
    <div
      className={`
        h-full flex flex-col
        rounded-2xl
        p-6 sm:p-7
        bg-white dark:bg-gray-800/60
        ring-1 ring-gray-200 dark:ring-gray-700
        transition-all duration-[180ms] ease-out
        hover:-translate-y-0.5 hover:shadow-lg hover:ring-gray-300 dark:hover:ring-gray-600
        ${className}
      `}
    >
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{name}</h3>
        {isCurrent && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ochre-700 dark:text-ochre-300 bg-ochre-100/60 dark:bg-ochre-900/30 px-2 py-0.5 rounded">
            Current
          </span>
        )}
      </div>
      <div className="mb-1">
        <span
          className="font-display text-4xl sm:text-5xl text-gray-900 dark:text-white"
          style={{
            fontFeatureSettings: '"ss01", "ss02"',
            fontVariationSettings: "'opsz' 72, 'wght' 580",
            letterSpacing: '-0.01em',
          }}
        >
          {price}
        </span>
      </div>
      {pricePeriod && <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">{pricePeriod}</div>}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">{audience}</p>

      <ul className="flex-1 space-y-2 mb-6">
        {features.map((feature) => (
          <li key={feature} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed flex items-start gap-2">
            <span aria-hidden="true" className="text-ochre-500 dark:text-ochre-400 mt-0.5">
              ·
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        {cta}
        {footnote && <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">{footnote}</div>}
      </div>
    </div>
  );
}
