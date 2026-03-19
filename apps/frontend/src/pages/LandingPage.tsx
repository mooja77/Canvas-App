import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function LandingPage() {
  const navigate = useNavigate();
  const authenticated = useAuthStore(s => s.authenticated);

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
          <span className="font-bold text-gray-900 dark:text-white">Canvas App</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/pricing" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            Pricing
          </Link>
          {authenticated ? (
            <Link to="/canvas" className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              Go to Canvas
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                Sign In
              </Link>
              <button
                onClick={() => navigate('/login')}
                className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Get Started Free
              </button>
            </>
          )}
        </div>
      </nav>

      <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white leading-tight mb-6">
          Qualitative coding
          <br />
          <span className="text-brand-600 dark:text-brand-400">made visual</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
          Code transcripts, discover patterns, and build theory — all on an infinite, interactive canvas.
          Built for researchers, by researchers.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3.5 rounded-lg font-semibold text-lg transition-colors shadow-lg shadow-brand-500/20"
          >
            Start Free
          </button>
          <Link
            to="/pricing"
            className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            View Pricing
          </Link>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          No credit card required. Free forever for basic use.
        </p>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
          Everything you need for qualitative analysis
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: 'Code Transcripts',
              desc: 'Highlight text, assign codes, and build your codebook. Drag codes into hierarchies. Merge and split as your analysis evolves.',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              ),
            },
            {
              title: 'Visual Canvas',
              desc: 'Arrange transcripts, codes, memos, and analysis nodes on an infinite canvas. See your entire project at a glance.',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
              ),
            },
            {
              title: '10 Analysis Tools',
              desc: 'Word clouds, co-occurrence, clustering, sentiment, framework matrix, treemaps, and more — all computed live.',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              ),
            },
            {
              title: 'Auto-Code',
              desc: 'Automatically apply codes across transcripts using keyword or regex patterns. Hours of coding done in seconds.',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              ),
            },
            {
              title: 'Cases & Cross-Case',
              desc: 'Organize transcripts into cases. Compare coding patterns across cases with the framework matrix.',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
              ),
            },
            {
              title: 'Ethics & Compliance',
              desc: 'Track consent, anonymize transcripts, set data retention dates, and maintain a full audit trail.',
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
            Ready to start coding?
          </h2>
          <p className="text-brand-100 mb-8">
            Join researchers using Canvas App for qualitative analysis. Free to start, powerful to grow.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="bg-white text-brand-700 px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-brand-50 transition-colors"
          >
            Create Free Account
          </button>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
          Common Questions
        </h2>
        <div className="space-y-4">
          {[
            { q: 'What is qualitative coding?', a: 'Qualitative coding is a research method where you assign labels (codes) to segments of text data like interviews or field notes, then analyze patterns across those codes to develop theories and insights.' },
            { q: 'Who is Canvas App for?', a: 'Canvas App is built for qualitative researchers, graduate students, UX researchers, and anyone who works with text data and needs to find patterns and themes.' },
            { q: 'How is this different from NVivo or ATLAS.ti?', a: 'Canvas App puts everything on a visual, interactive canvas instead of hiding data behind menus. You see transcripts, codes, memos, and analysis results all at once — making it easier to discover connections.' },
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

      {/* Social Proof */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { quote: 'Canvas App transformed how I approach thematic analysis. Being able to see everything on one canvas is a game-changer.', author: 'Dr. Sarah M.', role: 'Sociology Researcher' },
            { quote: 'My students picked it up in minutes. The visual interface makes qualitative coding accessible for beginners.', author: 'Prof. James T.', role: 'Research Methods Instructor' },
            { quote: 'The auto-code feature saved me hours of work. I can now focus on interpretation instead of mechanical coding.', author: 'Maria L.', role: 'PhD Candidate, Education' },
          ].map(t => (
            <div key={t.author} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 italic mb-4">"{t.quote}"</p>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.author}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      </main>
      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-8 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Canvas App</span>
          <div className="flex gap-4">
            <Link to="/pricing" className="hover:text-gray-700 dark:hover:text-gray-300">Pricing</Link>
            <Link to="/login" className="hover:text-gray-700 dark:hover:text-gray-300">Sign In</Link>
            <Link to="/terms" className="hover:text-gray-700 dark:hover:text-gray-300">Terms</Link>
            <Link to="/privacy" className="hover:text-gray-700 dark:hover:text-gray-300">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
