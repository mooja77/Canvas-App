import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';

export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const authenticated = useAuthStore(s => s.authenticated);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Nav */}
      <nav aria-label="Main navigation" className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900 dark:text-white">QualCanvas</span>
        </div>
        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-4">
          <Link to="/guide" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            Guide
          </Link>
          <Link to="/pricing" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            {t('pricing.title')}
          </Link>
          {authenticated ? (
            <Link to="/canvas" className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              Go to Canvas
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                {t('auth.signIn')}
              </Link>
              <button
                onClick={() => navigate('/login')}
                className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {t('pricing.getStarted')}
              </button>
            </>
          )}
        </div>
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="sm:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            )}
          </svg>
        </button>
      </nav>
      {/* Mobile nav menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden px-4 pb-4 space-y-2 border-b border-gray-200 dark:border-gray-700">
          <Link to="/pricing" className="block py-2 text-sm text-gray-600 dark:text-gray-400" onClick={() => setMobileMenuOpen(false)}>
            {t('pricing.title')}
          </Link>
          {authenticated ? (
            <Link to="/canvas" className="block py-2 text-sm bg-brand-600 text-white px-4 rounded-lg font-medium text-center" onClick={() => setMobileMenuOpen(false)}>
              Go to Canvas
            </Link>
          ) : (
            <>
              <Link to="/login" className="block py-2 text-sm text-gray-600 dark:text-gray-400" onClick={() => setMobileMenuOpen(false)}>
                {t('auth.signIn')}
              </Link>
              <button
                onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}
                className="w-full text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {t('pricing.getStarted')}
              </button>
            </>
          )}
        </div>
      )}

      <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
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
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          {t('landing.noCreditCard')}
        </p>
      </section>

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
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              ),
            },
            {
              title: t('landing.visualCanvas'),
              desc: t('landing.visualCanvasDesc'),
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
              ),
            },
            {
              title: t('landing.analysisTools'),
              desc: t('landing.analysisToolsDesc'),
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              ),
            },
            {
              title: t('landing.autoCode'),
              desc: t('landing.autoCodeDesc'),
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              ),
            },
            {
              title: t('landing.casesCrossCase'),
              desc: t('landing.casesCrossCaseDesc'),
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
              ),
            },
            {
              title: t('landing.ethicsCompliance'),
              desc: t('landing.ethicsComplianceDesc'),
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              ),
            },
          ].map(feature => (
            <div key={feature.title} className="p-6">
              <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  {feature.icon}
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            {t('landing.ctaTitle')}
          </h2>
          <p className="text-brand-100 mb-8">
            {t('landing.ctaDescription')}
          </p>
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
            { q: 'What is qualitative coding?', a: 'Qualitative coding is a research method where you assign labels (codes) to segments of text data like interviews or field notes, then analyze patterns across those codes to develop theories and insights.' },
            { q: 'Who is QualCanvas for?', a: 'QualCanvas is built for qualitative researchers, graduate students, UX researchers, and anyone who works with text data and needs to find patterns and themes.' },
            { q: 'How is this different from NVivo or ATLAS.ti?', a: 'QualCanvas puts everything on a visual, interactive canvas instead of hiding data behind menus. You see transcripts, codes, memos, and analysis results all at once — making it easier to discover connections.' },
            { q: 'Is my research data secure?', a: 'Yes. Your data is encrypted in transit and at rest. We offer ethics compliance tools including consent tracking, data anonymization, and full audit trails for IRB requirements.' },
          ].map(({ q, a }) => (
            <details key={q} className="group bg-gray-50 dark:bg-gray-800 rounded-xl">
              <summary className="flex items-center justify-between cursor-pointer p-4 text-sm font-medium text-gray-900 dark:text-white list-none">
                {q}
                <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </summary>
              <p className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Built for Researchers */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: t('landing.visualCoding'), description: 'See your entire codebook, transcripts, and relationships on one interactive canvas. Drag to connect, click to code.', icon: 'M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 0 1-1.125-1.125v-3.75ZM14.25 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v4.875c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-4.875Z' },
            { title: t('landing.aiAssisted'), description: 'Bring your own API key for AI-powered coding suggestions, research chat, transcription, and thematic summarization.', icon: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z' },
            { title: t('landing.academicStandards'), description: 'QDPX import/export for NVivo/ATLAS.ti interoperability. Cohen\'s Kappa intercoder reliability. Ethics compliance built in.', icon: 'M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5' },
          ].map(item => (
            <div key={item.title} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30">
                  <svg className="h-5 w-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      </main>
      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-8 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>&copy; {new Date().getFullYear()} QualCanvas. All rights reserved. &middot; Made by <a href="https://www.jmsdevlab.com/" target="_blank" rel="noopener" className="font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">JMS Dev Lab</a></span>
          <div className="flex gap-4">
            <Link to="/guide" className="hover:text-gray-700 dark:hover:text-gray-300">Guide</Link>
            <Link to="/pricing" className="hover:text-gray-700 dark:hover:text-gray-300">{t('pricing.title')}</Link>
            <Link to="/login" className="hover:text-gray-700 dark:hover:text-gray-300">{t('auth.signIn')}</Link>
            <Link to="/terms" className="hover:text-gray-700 dark:hover:text-gray-300">Terms</Link>
            <Link to="/privacy" className="hover:text-gray-700 dark:hover:text-gray-300">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
