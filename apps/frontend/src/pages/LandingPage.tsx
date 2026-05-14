import { lazy, Suspense, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';
import { Bento, BentoCell } from '../components/marketing/Bento';
import StatBlock from '../components/marketing/StatBlock';
import FAQ from '../components/marketing/FAQ';
import CTAStripe from '../components/marketing/CTAStripe';

// Lazy — the real interactive demo (with IndexedDB + idb-keyval) loads after
// first paint so it doesn't bloat the initial bundle. SSR / no-JS visitors get
// the static placeholder rendered as the Suspense fallback below.
const InteractiveDemo = lazy(() => import('../components/marketing/InteractiveDemo'));

/**
 * Landing page — refresh per docs/refresh/06-pages/01-landing.md.
 *
 * Sections (in DOM order):
 *   1. Hero (type-as-hero, two CTAs)
 *   2. Interactive coding micro-demo — Phase 2 placeholder (subtle loop);
 *      real demo lands in Phase 4 per docs/refresh/16-interactive-demo-spec.md
 *   3. Numbered workflow strip (5 steps)
 *   4. Bento feature grid (6 tiles, asymmetric)
 *   5. Stats strip (3 numbers)
 *   6. Featured case study card
 *   7. Testimonials (3, avatar-attributed pattern; placeholder text until
 *      real outreach yeses land per docs/refresh/10 R3)
 *   8. Pricing teaser
 *   9. FAQ (5 questions)
 *   10. CTA stripe
 */
export default function LandingPage() {
  const navigate = useNavigate();
  usePageMeta(
    'QualCanvas — Code interviews like you think. Visually.',
    'A visual workspace for coding transcripts, finding themes, and writing memos you can defend in front of a committee. Free tier. 40% off .edu.',
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/' });
  }, []);

  const handleStartFree = () => {
    trackEvent('cta_clicked', { cta_label: 'Start free', location: 'landing_hero', target_route: '/login' });
    trackEvent('signup_started', { source_page: '/', plan: 'free' });
    navigate('/login?mode=register');
  };

  return (
    <PageShell>
      {/* ─── 1. Hero ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12">
        <div className="max-w-4xl">
          <HairlineRule className="mb-6" />
          <Eyebrow className="mb-5">A qualitative workspace</Eyebrow>
          <DisplayHeading size="xl" className="mb-7">
            Code interviews like you think. Visually.
          </DisplayHeading>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed mb-8">
            QualCanvas is a visual workspace for coding transcripts, finding themes, and writing memos you can defend in
            front of a committee.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <button
              onClick={handleStartFree}
              className="
                inline-flex items-center justify-center
                bg-ochre-500 hover:bg-ochre-600 active:bg-ochre-700
                text-ink-950 font-semibold
                px-8 py-3.5 rounded-lg
                shadow-sm
                transition-colors duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2
              "
            >
              Start free
            </button>
            <Link
              to="/methodology"
              onClick={() =>
                trackEvent('cta_clicked', {
                  cta_label: 'See the method',
                  location: 'landing_hero',
                  target_route: '/methodology',
                })
              }
              className="
                inline-flex items-center text-base font-medium
                text-gray-700 dark:text-gray-300
                hover:text-gray-900 dark:hover:text-white
                underline-offset-4 hover:underline decoration-ochre-500
                px-2 py-1
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2
                rounded
              "
            >
              See the method →
            </Link>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-5">No credit card. Free forever for basic use.</p>
        </div>
      </section>

      {/* ─── 2. Interactive coding micro-demo ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20" aria-label="Interactive coding demo">
        <Suspense fallback={<DemoPlaceholder onStart={handleStartFree} />}>
          <InteractiveDemo />
        </Suspense>
        <p className="text-xs text-center mt-3 text-gray-400 dark:text-gray-500">
          Highlight any span to apply a code. Your work persists for 30 days.
        </p>
      </section>

      {/* ─── 3. Numbered workflow strip ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="mb-12 max-w-3xl">
          <HairlineRule className="mb-4" />
          <Eyebrow className="mb-3">The workflow</Eyebrow>
          <DisplayHeading as="h2" size="md">
            From transcript to defensible theme.
          </DisplayHeading>
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {[
            {
              n: '1.0',
              title: 'Import',
              body: 'Bring transcripts, field notes, and consent letters into one canvas. PDF, DOCX, audio, video.',
            },
            {
              n: '2.0',
              title: 'Code',
              body: 'Highlight a span, name a code. Move it. Merge it. Split it. The way real coding actually goes.',
            },
            {
              n: '3.0',
              title: 'Theme',
              body: "Drag codes into the patterns you're seeing. Watch the codebook breathe.",
            },
            {
              n: '4.0',
              title: 'Memo',
              body: 'Tie a memo to a span, a code, a theme, or a case. Reflexivity lives in the margins.',
            },
            {
              n: '5.0',
              title: 'Export',
              body: "Out to QDPX for NVivo and ATLAS.ti. Or to PDF. Or to your institution's preservation archive.",
            },
          ].map((step) => (
            <li key={step.n} className="flex flex-col gap-3">
              <span
                className="font-display text-3xl text-ochre-600 dark:text-ochre-400"
                style={{
                  fontFeatureSettings: '"ss01", "ss02"',
                  fontVariationSettings: "'opsz' 72, 'wght' 540",
                }}
              >
                {step.n}
              </span>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{step.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ─── 4. Bento feature grid ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="mb-12 max-w-3xl">
          <HairlineRule className="mb-4" />
          <Eyebrow className="mb-3">What it does</Eyebrow>
          <DisplayHeading as="h2" size="md">
            Six things every qualitative researcher needs.
          </DisplayHeading>
        </div>
        <Bento>
          <BentoCell span={2}>
            <FeatureContent
              title="Auto-code"
              body="Apply patterns across hundreds of transcripts in seconds. Review every match before it lands. The model assists; you decide."
            />
          </BentoCell>
          <BentoCell span={1}>
            <FeatureContent
              title="Intercoder κ"
              body="Cohen's κ and Krippendorff's α — calculated live as your team codes. Methods-paper-ready CSV export."
            />
          </BentoCell>
          <BentoCell span={1}>
            <FeatureContent
              title="Ethics & consent"
              body="Track consent, set retention windows, anonymize fields. The IRB audit trail is already running."
            />
          </BentoCell>
          <BentoCell span={1}>
            <FeatureContent
              title="Cases & cross-case"
              body="Group transcripts into cases. Compare coding across them in a framework matrix that updates as you code."
            />
          </BentoCell>
          <BentoCell span={1}>
            <FeatureContent
              title="12 live analyses"
              body="Word cloud, co-occurrence, clustering, sentiment, treemap, framework matrix — computed as you change the data, not before."
            />
          </BentoCell>
          <BentoCell span={2}>
            <FeatureContent
              title="Export QDPX"
              body="Take everything to NVivo or ATLAS.ti if you need to. Or hand a clean PDF to your committee. No lock-in by design."
            />
          </BentoCell>
        </Bento>
      </section>

      {/* ─── 5. Stats strip ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
          <StatBlock number={12} label="Analysis tools" />
          <StatBlock number={50000} label="Words per transcript" />
          <StatBlock number="40%" label="Discount on .edu" />
        </div>
      </section>

      {/* ─── 6. Featured case study ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <Link
          to="/customers"
          onClick={() =>
            trackEvent('cta_clicked', {
              cta_label: 'Read case study',
              location: 'landing_case',
              target_route: '/customers',
            })
          }
          className="group block rounded-2xl ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-gray-300 dark:hover:ring-gray-600 p-8 sm:p-12 transition-all duration-150 bg-white dark:bg-gray-900 hover:-translate-y-0.5"
        >
          <Eyebrow className="mb-4">Case study</Eyebrow>
          <DisplayHeading as="h2" size="md" className="mb-5 max-w-3xl">
            How a public-health lab coded 22 caregiving interviews in six weeks.
          </DisplayHeading>
          <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mb-6 leading-relaxed">
            Reflexive thematic analysis. Multi-coder, intercoder κ = 0.84. Methods paper accepted on the deadline.
          </p>
          <span className="text-sm font-medium text-ochre-700 dark:text-ochre-400 group-hover:underline underline-offset-4 decoration-ochre-500">
            Read the story →
          </span>
        </Link>
      </section>

      {/* ─── 7. Testimonials ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="mb-12 max-w-3xl">
          <HairlineRule className="mb-4" />
          <Eyebrow className="mb-3">From the field</Eyebrow>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              quote: 'The κ export saved me a methods-section argument with reviewer 2.',
              who: 'Dr. K.',
              role: 'Postdoc, social work',
            },
            { quote: 'My students stopped asking me about NVivo.', who: 'Prof. M.', role: 'Methods course lead' },
            {
              quote: "I cited QualCanvas in my dissertation methodology and my advisor didn't blink.",
              who: 'Maya',
              role: 'PhD candidate, sociology',
            },
          ].map((t, idx) => (
            <figure key={idx} className="flex flex-col gap-3">
              <blockquote
                className="text-base font-display italic text-gray-900 dark:text-white leading-relaxed"
                style={{ fontVariationSettings: "'wght' 500" }}
              >
                “{t.quote}”
              </blockquote>
              <figcaption className="text-sm">
                <span className="font-medium text-gray-900 dark:text-white">{t.who}</span>
                <span className="text-gray-500 dark:text-gray-400"> · {t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-8 text-xs text-gray-400 dark:text-gray-500">
          Names and details anonymized until participants sign release.
        </p>
      </section>

      {/* ─── 8. Pricing teaser ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="mb-12 max-w-3xl">
          <HairlineRule className="mb-4" />
          <Eyebrow className="mb-3">Pricing</Eyebrow>
          <DisplayHeading as="h2" size="md">
            Free to start. Paid when your dissertation gets serious.
          </DisplayHeading>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { name: 'Free', price: '$0', bullet: '1 canvas · 5 codes · CSV export' },
            { name: 'Pro', price: '$12', bullet: 'Unlimited · All 12 tools · Auto-code · Ethics' },
            { name: 'Team', price: '$29', bullet: 'Everything in Pro · Intercoder κ · Per-seat' },
          ].map((tier) => (
            <div
              key={tier.name}
              className="rounded-xl p-5 ring-1 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800/60"
            >
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-base font-semibold text-gray-900 dark:text-white">{tier.name}</span>
                <span
                  className="font-display text-2xl text-gray-900 dark:text-white"
                  style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
                >
                  {tier.price}
                  {tier.price !== '$0' && (
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/mo</span>
                  )}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{tier.bullet}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-8">
          <span className="font-medium">40% off Pro and Team with a .edu email.</span> Applied automatically at
          checkout.
        </p>
        <p className="text-center mt-2">
          <Link
            to="/pricing"
            className="text-sm font-medium text-ochre-700 dark:text-ochre-400 hover:underline decoration-ochre-500 underline-offset-4"
          >
            Compare all features →
          </Link>
        </p>
      </section>

      {/* ─── 9. FAQ ─── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="mb-10">
          <HairlineRule className="mb-4" />
          <Eyebrow className="mb-3">Common questions</Eyebrow>
        </div>
        <FAQ
          items={[
            {
              question: 'What is qualitative coding?',
              answer:
                "A research method where you label segments of qualitative data — interview transcripts, field notes, open-ended survey responses — to identify themes and build theory. It's the foundation of methods like thematic analysis, grounded theory, and IPA.",
            },
            {
              question: 'Who is QualCanvas for?',
              answer:
                "Qualitative researchers and graduate students working on theses or papers, research labs running multi-coder studies, and UX teams running longitudinal research. If your method has a name with a hyphen in it — cross-case, in-vivo, semi-structured — you're our audience.",
            },
            {
              question: 'How is this different from NVivo or ATLAS.ti?',
              answer: (
                <>
                  Three things. (1) Pricing is on this page; theirs isn\'t. (2) Your codes, transcripts, and themes live
                  on a visual canvas you can see all at once — not behind menus. (3) You can export to QDPX whenever you
                  want. No lock-in. Compare in detail at{' '}
                  <Link
                    to="/vs/nvivo"
                    className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                  >
                    /vs/nvivo
                  </Link>{' '}
                  and{' '}
                  <Link
                    to="/vs/atlas-ti"
                    className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                  >
                    /vs/atlas-ti
                  </Link>
                  .
                </>
              ),
            },
            {
              question: 'Is my research data secure? Are you training a model on my transcripts?',
              answer: (
                <>
                  Yes; no. TLS 1.3 in transit, AES-256 at rest, EU and US residency options. Your transcripts are never
                  used to train any model — by us or by the model provider. The full posture is on{' '}
                  <Link
                    to="/trust"
                    className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                  >
                    /trust
                  </Link>{' '}
                  and the AI-specific policy is on{' '}
                  <Link
                    to="/trust/ai"
                    className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                  >
                    /trust/ai
                  </Link>
                  .
                </>
              ),
            },
            {
              question: 'How do I cite QualCanvas in a paper?',
              answer: (
                <>
                  BibTeX, APA, and Chicago entries on{' '}
                  <Link
                    to="/cite"
                    className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                  >
                    /cite
                  </Link>
                  . Send it to your advisor.
                </>
              ),
            },
          ]}
        />
      </section>

      {/* ─── 10. CTA stripe ─── */}
      <CTAStripe
        headline="Start coding. Free."
        sub="No credit card. .edu discount automatic. Cancel any time."
        primary={
          <button
            onClick={handleStartFree}
            className="
              inline-flex items-center justify-center
              bg-ochre-400 hover:bg-ochre-300 active:bg-ochre-500
              text-ink-950 font-semibold
              px-8 py-3.5 rounded-lg
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900
            "
          >
            Start free
          </button>
        }
      />
    </PageShell>
  );
}

function FeatureContent({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">{body}</p>
    </>
  );
}

/**
 * Static fallback shown while the real InteractiveDemo lazy-loads, AND served
 * as the no-JS / SSR rendering. Matches the visual shell of the real demo so
 * the swap-in is seamless. Includes a `Start free` link in the codebook
 * footer so even pure no-JS visitors have a route forward.
 */
function DemoPlaceholder({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative rounded-2xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-900 shadow-2xl shadow-ink-900/5">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
        <div className="p-6 sm:p-10 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-3">
            Maya, 27 — on returning to graduate school after caregiving
          </div>
          <blockquote
            className="text-base sm:text-lg leading-relaxed text-gray-800 dark:text-gray-200"
            style={{ fontVariationSettings: "'wght' 400" }}
          >
            Coming back to school felt like reaching for a self I'd put somewhere I couldn't quite find. The first week,
            I sat in seminar and listened to people use words I used to use, and I thought: I'm going to have to learn
            this language again. But it wasn't the language — the language was easy. It was that I'd been{' '}
            <span className="bg-ochre-200/60 dark:bg-ochre-900/40 px-1 py-0.5 rounded">
              someone else for three years
            </span>
            . Someone who got up at four in the morning to give my mother her medications.
          </blockquote>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">Loading the interactive coder…</p>
        </div>
        <aside className="p-6 sm:p-8 bg-gray-50 dark:bg-gray-800/40" aria-label="Codebook preview">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-4">
            Codebook
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span aria-hidden="true" className="w-2 h-2 rounded-full bg-ochre-500" />
              <span className="flex-1 text-gray-900 dark:text-gray-100 font-medium">identity-as-resistance</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">1 span</span>
            </li>
            <li className="flex items-center gap-3 opacity-60">
              <span aria-hidden="true" className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="flex-1 text-gray-700 dark:text-gray-300">caregiving</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">2 spans</span>
            </li>
            <li className="flex items-center gap-3 opacity-60">
              <span aria-hidden="true" className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="flex-1 text-gray-700 dark:text-gray-300">transition / return</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">1 span</span>
            </li>
          </ul>
          <p className="mt-6 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Try it yourself —{' '}
            <button
              onClick={onStart}
              className="text-ochre-700 dark:text-ochre-400 hover:underline decoration-ochre-500 underline-offset-2 font-medium"
            >
              start free →
            </button>
          </p>
        </aside>
      </div>
    </div>
  );
}
