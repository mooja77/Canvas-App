import { ReactNode } from 'react';

export interface CompetitorEntry {
  name: string;
  /** Display price like "$12/mo" or "Contact sales". */
  pricing: string;
  /** Optional link out to the competitor's pricing page or QualCanvas /vs/ comparison. */
  href?: string;
  /** "/vs/" link slug; if provided, shown as "See the comparison →" CTA. */
  vsSlug?: string;
}

interface CompetitorRowProps {
  eyebrow?: ReactNode;
  /** Optional source note + date stamp, e.g. "Prices verified 2026-05-14". */
  footnote?: ReactNode;
  /** QualCanvas comes first; competitors stack to the right (or below on mobile). */
  qualcanvas: { pricing: string; note?: string };
  competitors: CompetitorEntry[];
  className?: string;
}

/**
 * Side-by-side competitor pricing strip used on `/pricing` and the quick-verdict
 * tables on `/vs/*` per docs/refresh/06-pages/02-pricing.md and §6.14.
 *
 * Voice rule: sourced + dated. Every cell has a source link or footnote.
 * No competitive trash-talk; the honesty is the marketing.
 */
export default function CompetitorRow({
  eyebrow,
  footnote,
  qualcanvas,
  competitors,
  className = '',
}: CompetitorRowProps) {
  return (
    <section className={className}>
      {eyebrow && (
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-3">
          {eyebrow}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-5 bg-white dark:bg-gray-800/60 ring-2 ring-ochre-500/40">
          <div className="text-xs font-semibold uppercase tracking-wider text-ochre-700 dark:text-ochre-300 mb-1">
            QualCanvas
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">{qualcanvas.pricing}</div>
          {qualcanvas.note && <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{qualcanvas.note}</div>}
        </div>

        {competitors.map((c) => (
          <div
            key={c.name}
            className="rounded-xl p-5 bg-white dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700"
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              {c.name}
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{c.pricing}</div>
            <div className="mt-2 flex flex-col gap-1 text-xs">
              {c.href && (
                <a
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline-offset-2 hover:underline"
                >
                  Source ↗
                </a>
              )}
              {c.vsSlug && (
                <a
                  href={`/vs/${c.vsSlug}`}
                  className="text-ochre-700 dark:text-ochre-400 hover:text-ochre-800 dark:hover:text-ochre-300 underline-offset-2 hover:underline"
                >
                  See the comparison →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {footnote && <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">{footnote}</div>}
    </section>
  );
}
