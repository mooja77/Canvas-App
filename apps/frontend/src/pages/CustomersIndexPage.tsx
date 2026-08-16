import { useEffect } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';

/**
 * /customers — research stories index per docs/refresh/06-pages/04.
 *
 * Real customer stories ship via MDX during Phase 3 follow-on, after
 * outreach yeses land (docs/refresh/10 R3 + §8.6 sourcing email).
 * Until then, the page is honest about the state — one worked-example
 * card to set the bar (per §8.8), plus a participation invite.
 */
export default function CustomersIndexPage() {
  usePageMeta(
    'Worked research examples — QualCanvas',
    'Synthetic, clearly labelled examples showing how qualitative researchers can structure work in QualCanvas.',
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/customers' });
  }, []);

  return (
    <PageShell>
      <article className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <HairlineRule className="mb-6" />
        <Eyebrow className="mb-3">Research stories</Eyebrow>
        <DisplayHeading size="lg" className="mb-7">
          What researchers do with QualCanvas.
        </DisplayHeading>
        <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">
          Clearly labelled worked examples show how the product can support a study. Customer stories will only appear
          here after the participant has reviewed and approved them.
        </p>

        {/* Worked example card — sets the bar per §8.8 */}
        <section className="mt-16">
          <div className="rounded-2xl p-8 sm:p-10 bg-white dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700">
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <Eyebrow>Worked example</Eyebrow>
              <span className="text-xs text-gray-500 dark:text-gray-400">Synthetic · 6 min read</span>
            </div>
            <DisplayHeading as="h2" size="md" className="mb-4 max-w-3xl">
              A synthetic public-health coding exercise with 22 caregiving interviews.
            </DisplayHeading>
            <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-6">
              This is a fictional workflow demonstration, not a customer result or endorsement.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              <Stat number="22" label="Transcripts coded" />
              <Stat number="4" label="Fictional coders" />
              <Stat number="κ = 0.84" label="Illustrative result" />
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-2xl text-gray-700 dark:text-gray-300 leading-relaxed">
              <p>
                <strong className="font-semibold text-gray-900 dark:text-white">Scenario.</strong> A four-person team
                needs to code 22 synthetic interviews while keeping its code definitions and coding decisions visible to
                everyone.
              </p>
              <p>
                <strong className="font-semibold text-gray-900 dark:text-white">Demonstrated workflow.</strong>{' '}
                Collaborators work in one canvas, record coding decisions in memos, and run an intercoder calculation
                after coding is complete.
              </p>
              <p>
                <strong className="font-semibold text-gray-900 dark:text-white">Example output.</strong> The synthetic
                dataset produces an illustrative κ of 0.84. It demonstrates the report format only and does not predict
                a real study&apos;s agreement or research outcome.
              </p>
            </div>
          </div>
        </section>

        {/* Participation invite */}
        <section className="mt-16 pt-10 border-t border-gray-200 dark:border-gray-800">
          <h2
            className="font-display text-2xl mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Tell us your study.
          </h2>
          <div className="prose prose-base dark:prose-invert max-w-2xl text-gray-700 dark:text-gray-300 leading-relaxed">
            <p>
              If QualCanvas was part of how you coded your last study, we'd love to feature your work. About 800 words
              total — three sections (challenge / approach / outcome), three numbers, one quote. You can be anonymized
              at any granularity, from named institution + named you to fully anonymous worked example.
            </p>
            <p>
              The commitment is a 45-minute call, two email rounds on the draft, and final review rights before publish.
              We pay a $200 honorarium (cash or charitable donation in your name).
            </p>
            <p>
              Interested? Email{' '}
              <a
                className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                href="mailto:stories@qualcanvas.com?subject=Customer%20story%20participation"
              >
                stories@qualcanvas.com
              </a>{' '}
              with a one-line description of your study. We'll send a draft outline before you decide.
            </p>
          </div>
        </section>
      </article>
    </PageShell>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div
        className="font-display text-3xl sm:text-4xl text-gray-900 dark:text-white leading-none mb-2"
        style={{ fontFeatureSettings: '"ss01"', fontVariationSettings: "'opsz' 96, 'wght' 560" }}
      >
        {number}
      </div>
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}
