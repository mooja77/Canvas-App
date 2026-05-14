import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../hooks/usePageMeta';
import PageShell from '../components/marketing/PageShell';

export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  usePageMeta(
    'QualCanvas — Visual Workspace for Qualitative Research',
    'Code interview transcripts visually. Thematic analysis, grounded theory, IPA. Free tier available.',
  );

  return (
    <PageShell>
      <div>
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-4 pt-20 pb-8 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white leading-tight mb-6">
            {t('landing.heroTitle')}
            <br />
            <span className="text-brand-600 dark:text-brand-400">{t('landing.heroHighlight')}</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
            {t('landing.heroDescription')}
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3.5 rounded-lg font-semibold text-lg transition-colors shadow-lg shadow-brand-500/20"
            >
              {t('landing.startFree')}
            </button>
            <Link
              to="/pricing"
              className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {t('landing.viewPricing')}
            </Link>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">{t('landing.noCreditCard')}</p>
        </section>

        {/* Hero screenshot — lives outside the narrow hero column so it can
            span a wider container (max-w-7xl) than the text above. */}
        <div className="mx-auto max-w-7xl px-4 pb-16">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute inset-x-8 -top-4 h-32 bg-gradient-to-b from-brand-400/20 to-transparent blur-3xl -z-10"
            />
            <img
              src="/hero-canvas.png"
              alt="QualCanvas workspace showing a coded transcript with sentiment and word cloud analysis nodes"
              width={1600}
              height={1000}
              loading="eager"
              className="w-full h-auto rounded-xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-800"
            />
          </div>
        </div>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            {t('landing.featuresTitle')}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: t('landing.codeTranscripts'),
                desc: t('landing.codeTranscriptsDesc'),
                tileBg: 'bg-blue-100 dark:bg-blue-900/30',
                iconColor: 'text-blue-600 dark:text-blue-400',
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                ),
              },
              {
                title: t('landing.visualCanvas'),
                desc: t('landing.visualCanvasDesc'),
                tileBg: 'bg-purple-100 dark:bg-purple-900/30',
                iconColor: 'text-purple-600 dark:text-purple-400',
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5"
                  />
                ),
              },
              {
                title: t('landing.analysisTools'),
                desc: t('landing.analysisToolsDesc'),
                tileBg: 'bg-emerald-100 dark:bg-emerald-900/30',
                iconColor: 'text-emerald-600 dark:text-emerald-400',
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                  />
                ),
              },
              {
                title: t('landing.autoCode'),
                desc: t('landing.autoCodeDesc'),
                tileBg: 'bg-amber-100 dark:bg-amber-900/30',
                iconColor: 'text-amber-600 dark:text-amber-400',
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
                  />
                ),
              },
              {
                title: t('landing.casesCrossCase'),
                desc: t('landing.casesCrossCaseDesc'),
                tileBg: 'bg-rose-100 dark:bg-rose-900/30',
                iconColor: 'text-rose-600 dark:text-rose-400',
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                  />
                ),
              },
              {
                title: t('landing.ethicsCompliance'),
                desc: t('landing.ethicsComplianceDesc'),
                tileBg: 'bg-indigo-100 dark:bg-indigo-900/30',
                iconColor: 'text-indigo-600 dark:text-indigo-400',
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                  />
                ),
              },
            ].map((feature) => (
              <div key={feature.title} className="p-6">
                <div className={`w-10 h-10 ${feature.tileBg} rounded-lg flex items-center justify-center mb-4`}>
                  <svg
                    className={`w-5 h-5 ${feature.iconColor}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    {feature.icon}
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing teaser — anchor prices before the CTA so users don't
            have to leave the page to understand what "Start Free" buys. */}
        <section className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-10">
            Simple, transparent pricing
          </h2>
          <div className="grid md:grid-cols-3 gap-4 items-stretch">
            {[
              {
                name: 'Free',
                price: '$0',
                tagline: 'For trying it out',
                bullet: '1 canvas · 5 codes · CSV export',
              },
              {
                name: 'Pro',
                price: '$12',
                tagline: 'For working researchers',
                bullet: 'Unlimited everything · 10 analysis tools · AI',
                highlight: true,
              },
              {
                name: 'Team',
                price: '$29',
                tagline: 'For research groups',
                bullet: 'Everything in Pro · Kappa · team management',
              },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`h-full flex flex-col rounded-xl p-5 ring-1 ${
                  tier.highlight
                    ? 'ring-2 ring-brand-500 bg-brand-50/30 dark:bg-brand-900/10'
                    : 'ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-800/30'
                }`}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{tier.name}</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {tier.price}
                    {tier.price !== '$0' && (
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/mo</span>
                    )}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{tier.tagline}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{tier.bullet}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-8">
            <Link
              to="/pricing"
              className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
            >
              Compare all features →
            </Link>
          </p>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-white mb-4">{t('landing.ctaTitle')}</h2>
            <p className="text-brand-100 mb-8">{t('landing.ctaDescription')}</p>
            <button
              onClick={() => navigate('/login')}
              className="bg-white text-brand-700 px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-brand-50 transition-colors"
            >
              {t('landing.createFreeAccount')}
            </button>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
            {t('landing.commonQuestions')}
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'What is qualitative coding?',
                a: 'Qualitative coding is a research method where you assign labels (codes) to segments of text data like interviews or field notes, then analyze patterns across those codes to develop theories and insights.',
              },
              {
                q: 'Who is QualCanvas for?',
                a: 'QualCanvas is built for qualitative researchers, graduate students, UX researchers, and anyone who works with text data and needs to find patterns and themes.',
              },
              {
                q: 'How is this different from NVivo or ATLAS.ti?',
                a: 'QualCanvas puts everything on a visual, interactive canvas instead of hiding data behind menus. You see transcripts, codes, memos, and analysis results all at once — making it easier to discover connections.',
              },
              {
                q: 'Is my research data secure?',
                a: 'Yes. Your data is encrypted in transit and at rest. We offer ethics compliance tools including consent tracking, data anonymization, and full audit trails for IRB requirements.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group bg-gray-50 dark:bg-gray-800 rounded-xl">
                <summary className="flex items-center justify-between cursor-pointer p-4 text-sm font-medium text-gray-900 dark:text-white list-none">
                  {q}
                  <svg
                    className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </summary>
                <p className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
