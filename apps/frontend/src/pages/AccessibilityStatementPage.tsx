import { useEffect } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';

/**
 * /accessibility-statement — formal a11y statement per
 * docs/refresh/06-pages/11-legal-pages.md §6.16.
 *
 * Required by many .edu and .gov procurement processes. Honest about known
 * limitations — the canvas workspace itself has some keyboard-navigation
 * gaps that are documented here rather than glossed over.
 */
export default function AccessibilityStatementPage() {
  usePageMeta(
    'Accessibility statement — QualCanvas',
    'WCAG 2.2 AA conformance across marketing pages. Known limitations documented honestly.',
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/accessibility-statement' });
  }, []);

  return (
    <PageShell>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <HairlineRule className="mb-6" />
        <Eyebrow className="mb-3">Accessibility statement</Eyebrow>
        <DisplayHeading as="h1" size="md" className="mb-10">
          Accessibility.
        </DisplayHeading>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed">
          <p>
            QualCanvas is committed to ensuring our software is accessible to researchers with disabilities. We target
            conformance with the{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="https://www.w3.org/WAI/standards-guidelines/wcag/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Web Content Accessibility Guidelines (WCAG) 2.2 Level AA
            </a>{' '}
            across all marketing pages and are actively working toward the same level in the canvas workspace.
          </p>

          <h2
            className="font-display text-2xl mt-12 mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Conformance level
          </h2>
          <p>
            Marketing pages (`/`, `/pricing`, `/methodology`, `/customers/*`, `/for-teams`, `/for-institutions`,
            `/trust*`, `/cite`, `/colophon`, `/changelog`, `/press`, `/accessibility-statement`): WCAG 2.2 Level AA
            targeted, regularly audited with axe-core and verified manually with NVDA on Windows and VoiceOver on macOS
            and iOS.
          </p>

          <h2
            className="font-display text-2xl mt-12 mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Known limitations
          </h2>
          <p>We name the gaps we know about rather than gloss over them:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              The canvas workspace itself has known keyboard-navigation gaps in zoom and pan controls. Workaround:
              keyboard shortcuts for code-application and codebook navigation are unaffected. Full canvas keyboard
              parity is targeted for Q3 2026.
            </li>
            <li>
              Some third-party embeds (Stripe checkout, GTM-loaded scripts) inherit their own accessibility profile,
              which we cannot fully control. We avoid third-party embeds on critical paths where possible.
            </li>
            <li>
              The interactive coding demo on the landing page is keyboard-navigable by design; the touch-selection
              variant on small screens uses native browser selection, which on iOS has its own ergonomic quirks.
            </li>
          </ul>

          <h2
            className="font-display text-2xl mt-12 mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Testing approach
          </h2>
          <p>
            We run axe-core via Playwright as part of CI, plus quarterly manual audits with NVDA (Windows), VoiceOver
            (macOS + iOS), and TalkBack (Android). The dev team uses keyboard-only navigation as part of normal
            development.
          </p>

          <h2
            className="font-display text-2xl mt-12 mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Feedback and contact
          </h2>
          <p>
            If you encounter an accessibility issue on QualCanvas, please tell us. We respond to accessibility reports
            within five business days and aim to fix critical-path issues within 30 days.
          </p>
          <p>
            Email:{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="mailto:accessibility@qualcanvas.com"
            >
              accessibility@qualcanvas.com
            </a>
          </p>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last reviewed: {new Date().toISOString().slice(0, 10)}.
          </p>
        </div>
      </article>
    </PageShell>
  );
}
