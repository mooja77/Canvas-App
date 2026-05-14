import { useEffect } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';

/**
 * /changelog — release feed per docs/refresh/06-pages/08-changelog.md.
 *
 * Reverse-chron feed of shipped features. Entries are static seeds for now;
 * Phase 3 follow-on adds MDX-driven entries and an RSS feed at /changelog/feed.xml
 * (generated at build time from git history per the §9.6 content pipeline).
 *
 * Pattern is Vercel-tight + Raycast-categorical, restrained tone. One entry
 * per shipped feature or every two weeks, whichever's more frequent.
 */

interface ChangelogEntry {
  date: string;
  title: string;
  body: string;
  highlights?: string[];
  fixes?: string[];
  author?: string;
  readMin?: number;
}

const ENTRIES: ChangelogEntry[] = [
  {
    date: '2026-05-14',
    title: 'Marketing site refresh — Tier 2 brand activated',
    body: 'The marketing surface (landing, pricing, methodology index, customers, /for-teams, /for-institutions, /trust/ai, /cite, /colophon, /accessibility-statement, /press) is now on the Ink + Ochre palette with Fraunces display headings. Visible via the override URL today; default-on flip during Phase 5 launch.',
    highlights: [
      'Hero rebuilt with type-as-hero Fraunces display, no gradient blob mesh',
      'Pricing now four tiers — Free / Pro / Team / Institutions — with sourced competitor comparison',
      '/cite ships with copy-to-clipboard BibTeX, APA, Chicago, RIS',
      'Footer "Built by JMS Dev Lab →" attribution + three-state theme toggle',
    ],
    fixes: [
      'OG image now self-hosted at /og-image.png (was a broken reference for months)',
      'Inter + Fraunces self-hosted, no more Google Fonts request',
    ],
    author: 'The team',
    readMin: 4,
  },
];

export default function ChangelogPage() {
  usePageMeta(
    'Changelog — QualCanvas',
    "What we've shipped, when, with bylines. RSS available. New entry per feature or every two weeks.",
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/changelog' });
  }, []);

  return (
    <PageShell>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <HairlineRule className="mb-6" />
        <Eyebrow className="mb-3">Changelog</Eyebrow>
        <DisplayHeading size="md" className="mb-7">
          What we've shipped.
        </DisplayHeading>
        <div className="flex items-baseline gap-4 text-sm text-gray-600 dark:text-gray-400">
          <a
            href="/changelog/feed.xml"
            onClick={() => trackEvent('changelog_subscribed' as never)}
            className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
          >
            Subscribe via RSS
          </a>
          <span>·</span>
          <a
            href="/subscribe"
            className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
          >
            By email
          </a>
        </div>

        {/* Entries */}
        <div className="mt-16 divide-y divide-gray-200 dark:divide-gray-800">
          {ENTRIES.map((entry, idx) => (
            <Entry key={idx} entry={entry} />
          ))}
        </div>

        {/* Backfill note */}
        <div className="mt-16 pt-10 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          <p>
            Older entries are being backfilled from git history through 2024. Until then, you can browse the full commit
            log on{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="https://github.com/mooja77"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </article>
    </PageShell>
  );
}

function Entry({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="py-10 first:pt-0">
      <div className="text-xs font-mono uppercase tracking-wider text-ochre-700 dark:text-ochre-400 mb-3">
        {entry.date}
      </div>
      <h2
        className="font-display text-2xl sm:text-3xl text-gray-900 dark:text-white mb-4 leading-tight"
        style={{ fontFeatureSettings: '"ss01"', fontVariationSettings: "'opsz' 96, 'wght' 580" }}
      >
        {entry.title}
      </h2>
      <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed mb-6">{entry.body}</p>

      {entry.highlights && entry.highlights.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Highlights
          </div>
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            {entry.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2">
                <span aria-hidden="true" className="text-ochre-500 mt-0.5">
                  ·
                </span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {entry.fixes && entry.fixes.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Fixes
          </div>
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            {entry.fixes.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span aria-hidden="true" className="text-gray-400 mt-0.5">
                  ·
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(entry.author || entry.readMin) && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          {entry.author && <>— {entry.author}</>}
          {entry.author && entry.readMin && <> · </>}
          {entry.readMin && <>{entry.readMin} min read</>}
        </div>
      )}
    </div>
  );
}
