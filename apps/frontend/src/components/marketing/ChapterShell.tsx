import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Eyebrow from './Eyebrow';
import HairlineRule from './HairlineRule';
import { trackEvent } from '../../utils/analytics';

export interface ChapterSection {
  id: string;
  label: string;
}

export interface ChapterNav {
  slug: string;
  title: string;
}

interface ChapterShellProps {
  number: string;
  title: string;
  subtitle?: string;
  readMin: number;
  updated: string;
  sections: ChapterSection[];
  prev?: ChapterNav | null;
  next?: ChapterNav | null;
  children: ReactNode;
}

/**
 * Layout shell for a single /methodology chapter. Anatomy per
 * docs/refresh/06-pages/03-methodology.md — max-measure body, sticky sidebar
 * TOC, prev/next, and a single "Try this in QualCanvas →" CTA at the bottom.
 */
export default function ChapterShell({
  number,
  title,
  subtitle,
  readMin,
  updated,
  sections,
  prev,
  next,
  children,
}: ChapterShellProps) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);
  const [tocOpen, setTocOpen] = useState(false);

  // Track which section is currently in view (intersection observer).
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            return;
          }
        }
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <article className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_220px] gap-x-10 lg:gap-x-12">
        {/* ── Sidebar TOC (sticky desktop) ── */}
        <nav
          aria-label="Chapter contents"
          className="hidden lg:block sticky top-24 self-start mt-32"
          style={{ maxHeight: 'calc(100vh - 8rem)', overflowY: 'auto' }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-4">
            Contents
          </p>
          <ol className="space-y-2.5 text-sm">
            {sections.map((s, idx) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={`block leading-snug transition-colors duration-150 ${
                    activeId === s.id
                      ? 'text-ochre-700 dark:text-ochre-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="text-xs text-gray-400 dark:text-gray-500 mr-2 tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* ── Main body ── */}
        <div className="max-w-[640px] mx-auto w-full lg:mx-0">
          <HairlineRule className="mb-6" />
          <Eyebrow className="mb-4">
            {number} · {title}
          </Eyebrow>
          <h1
            className="font-display text-[40px] sm:text-[48px] leading-[1.05] text-gray-900 dark:text-white mb-4"
            style={{
              fontFeatureSettings: '"ss01", "ss02"',
              fontVariationSettings: "'opsz' 96, 'wght' 580",
              letterSpacing: '-0.018em',
            }}
          >
            {title}.
          </h1>
          {subtitle && <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-6">{subtitle}</p>}
          <p className="text-xs uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-12">
            {readMin}&nbsp;min&nbsp;read · Updated {updated}
          </p>

          {/* Mobile TOC accordion */}
          <details
            open={tocOpen}
            onToggle={(e) => setTocOpen((e.currentTarget as HTMLDetailsElement).open)}
            className="lg:hidden mb-10 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
          >
            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
              Chapter contents
            </summary>
            <ol className="mt-4 space-y-2 text-sm">
              {sections.map((s, idx) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={() => setTocOpen(false)}
                    className="block text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <span className="text-xs text-gray-400 dark:text-gray-500 mr-2 tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </details>

          {/* ── Chapter prose ── */}
          <div
            className="
              prose-chapter
              text-[18px] sm:text-[19px] leading-[1.7]
              text-gray-800 dark:text-gray-200
              [&_p]:mb-6
              [&_h2]:font-display [&_h2]:text-[26px] sm:[&_h2]:text-[30px] [&_h2]:leading-[1.2]
              [&_h2]:font-semibold [&_h2]:text-gray-900 dark:[&_h2]:text-white
              [&_h2]:mt-16 [&_h2]:mb-5 [&_h2]:scroll-mt-24
              [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:text-gray-900 dark:[&_h3]:text-white
              [&_h3]:mt-10 [&_h3]:mb-3
              [&_strong]:text-gray-900 dark:[&_strong]:text-white [&_strong]:font-semibold
              [&_a]:underline [&_a]:decoration-ochre-500 [&_a]:underline-offset-2
              hover:[&_a]:text-gray-900 dark:hover:[&_a]:text-white
              [&_ul]:my-6 [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:marker:text-ochre-500
              [&_ol]:my-6 [&_ol]:space-y-2 [&_ol]:pl-6 [&_ol]:list-decimal
              [&_li]:leading-[1.65]
              [&_blockquote]:my-8 [&_blockquote]:pl-6 [&_blockquote]:border-l-2 [&_blockquote]:border-ochre-500
              [&_blockquote]:font-display [&_blockquote]:italic [&_blockquote]:text-[22px] sm:[&_blockquote]:text-[24px]
              [&_blockquote]:leading-[1.45] [&_blockquote]:text-gray-900 dark:[&_blockquote]:text-white
              [&_code]:font-mono [&_code]:text-[15px] [&_code]:bg-gray-100 dark:[&_code]:bg-gray-800
              [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-gray-900 dark:[&_code]:text-gray-100
            "
          >
            {children}
          </div>

          {/* ── Try-this CTA ── */}
          <div className="mt-20 pt-10 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-[0.08em]">
              Put this into practice
            </p>
            <Link
              to="/login?mode=register"
              onClick={() =>
                trackEvent('cta_clicked', {
                  cta_label: 'Try this in QualCanvas',
                  location: 'methodology_chapter',
                  target_route: '/login?mode=register',
                  chapter: number,
                })
              }
              className="
                inline-flex items-baseline gap-2
                font-display text-2xl sm:text-3xl
                text-gray-900 dark:text-white
                hover:text-ochre-700 dark:hover:text-ochre-400
                transition-colors duration-150
              "
              style={{ fontVariationSettings: "'wght' 540", letterSpacing: '-0.01em' }}
            >
              Try this in QualCanvas <span className="text-ochre-500">→</span>
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
              Free tier. No credit card. Bring your own transcript.
            </p>
          </div>

          {/* ── Prev / next nav ── */}
          {(prev || next) && (
            <nav
              aria-label="Chapter navigation"
              className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800 grid grid-cols-2 gap-6"
            >
              {prev ? (
                <Link
                  to={`/methodology/${prev.slug}`}
                  className="group block text-left"
                  onClick={() =>
                    trackEvent('cta_clicked', {
                      cta_label: 'Previous chapter',
                      location: 'methodology_chapter',
                      target_route: `/methodology/${prev.slug}`,
                    })
                  }
                >
                  <span className="block text-xs uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-1">
                    ← Previous
                  </span>
                  <span className="block font-display text-lg sm:text-xl text-gray-900 dark:text-white group-hover:text-ochre-700 dark:group-hover:text-ochre-400 transition-colors">
                    {prev.title}
                  </span>
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
              {next ? (
                <Link
                  to={`/methodology/${next.slug}`}
                  className="group block text-right"
                  onClick={() =>
                    trackEvent('cta_clicked', {
                      cta_label: 'Next chapter',
                      location: 'methodology_chapter',
                      target_route: `/methodology/${next.slug}`,
                    })
                  }
                >
                  <span className="block text-xs uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-1">
                    Next →
                  </span>
                  <span className="block font-display text-lg sm:text-xl text-gray-900 dark:text-white group-hover:text-ochre-700 dark:group-hover:text-ochre-400 transition-colors">
                    {next.title}
                  </span>
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
            </nav>
          )}

          {/* ── Back to index ── */}
          <div className="mt-12 text-center">
            <Link
              to="/methodology"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline decoration-ochre-500 underline-offset-2"
            >
              ← Back to the field guide
            </Link>
          </div>
        </div>

        {/* Right gutter — reserved for marginalia later */}
        <div className="hidden lg:block" aria-hidden="true" />
      </div>
    </article>
  );
}
