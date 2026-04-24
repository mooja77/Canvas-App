import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';

interface SiteHeaderProps {
  /** Hide the Sign In / Get Started CTAs — useful on the auth page itself. */
  hideAuthCtas?: boolean;
}

/**
 * Shared top navigation used across the marketing surface
 * (LandingPage, PricingPage, GuidePage, LoginPage).
 *
 * Previously duplicated inline on LandingPage; extracted so PricingPage
 * and LoginPage get the same logo + nav without user-facing drift.
 */
export default function SiteHeader({ hideAuthCtas = false }: SiteHeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const authenticated = useAuthStore((s) => s.authenticated);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <nav aria-label="Main navigation" className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group" aria-label="QualCanvas home">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          <span className="font-bold text-gray-900 dark:text-white">QualCanvas</span>
        </Link>

        <div className="hidden sm:flex items-center gap-4">
          <Link
            to="/guide"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Guide
          </Link>
          <Link
            to="/pricing"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            {t('pricing.title')}
          </Link>
          {!hideAuthCtas &&
            (authenticated ? (
              <Link
                to="/canvas"
                className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Go to Canvas
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {t('auth.signIn')}
                </Link>
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {t('pricing.getStarted')}
                </button>
              </>
            ))}
        </div>

        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="sm:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
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

      {mobileMenuOpen && (
        <div className="sm:hidden px-4 pb-4 space-y-2 border-b border-gray-200 dark:border-gray-700">
          <Link
            to="/guide"
            className="block py-2 text-sm text-gray-600 dark:text-gray-400"
            onClick={() => setMobileMenuOpen(false)}
          >
            Guide
          </Link>
          <Link
            to="/pricing"
            className="block py-2 text-sm text-gray-600 dark:text-gray-400"
            onClick={() => setMobileMenuOpen(false)}
          >
            {t('pricing.title')}
          </Link>
          {!hideAuthCtas &&
            (authenticated ? (
              <Link
                to="/canvas"
                className="block py-2 text-sm bg-brand-600 text-white px-4 rounded-lg font-medium text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Go to Canvas
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="block py-2 text-sm text-gray-600 dark:text-gray-400"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('auth.signIn')}
                </Link>
                <button
                  onClick={() => {
                    navigate('/login');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {t('pricing.getStarted')}
                </button>
              </>
            ))}
        </div>
      )}
    </>
  );
}
