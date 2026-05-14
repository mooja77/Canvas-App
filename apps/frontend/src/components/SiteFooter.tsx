import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import StudioCredit from './marketing/StudioCredit';
import StatusIndicator from './marketing/StatusIndicator';
import ThemeToggle from './marketing/ThemeToggle';

/**
 * Shared footer used across the marketing surface.
 *
 * Layout (post-refresh):
 *  - 4-col link grid (Product / Account / Legal / Company)
 *  - Copyright row
 *  - Bottom rail: Built by JMS Dev Lab → · Colophon · Status · ThemeToggle
 *  - Newsletter line (monthly methodology cadence, see open-decision #14)
 *
 * Spec: docs/refresh/06-pages/14-site-footer.md
 *
 * The duplicate "JMS Dev Lab" link in the Company column has moved to the
 * bottom rail (StudioCredit) so the credit reads as confidence, not promotion.
 */
export default function SiteFooter() {
  const { t } = useTranslation();
  const authenticated = useAuthStore((s) => s.authenticated);

  return (
    <footer className="max-w-6xl mx-auto px-4 py-10 border-t border-gray-200 dark:border-gray-800">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            Product
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/guide" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                Guide
              </Link>
            </li>
            <li>
              <Link
                to="/pricing"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                {t('pricing.title')}
              </Link>
            </li>
            <li>
              <Link
                to="/changelog"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Changelog
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            Account
          </h3>
          <ul className="space-y-2 text-sm">
            {authenticated ? (
              <li>
                <Link
                  to="/canvas"
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Go to Canvas
                </Link>
              </li>
            ) : (
              <>
                <li>
                  <Link
                    to="/login"
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {t('auth.signIn')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/login?mode=register"
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {t('pricing.getStarted')}
                  </Link>
                </li>
              </>
            )}
            <li>
              <Link
                to="/account"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Account settings
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            Legal
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/terms" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link
                to="/privacy"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/trust" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                Trust &amp; Security
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            Company
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/cite" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                How to cite
              </Link>
            </li>
            <li>
              <Link
                to="/colophon"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Colophon
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-gray-200/70 dark:border-gray-800/70 text-xs text-gray-500 dark:text-gray-500">
        <span>&copy; {new Date().getFullYear()} QualCanvas. All rights reserved.</span>
        <span>Built for qualitative researchers</span>
      </div>

      {/* Bottom rail — studio credit, status, theme toggle. The discreet
          JMS Dev Lab attribution lives here, replacing the buried link
          that was in the Company column pre-refresh. */}
      <div className="mt-6 pt-6 border-t border-gray-200/40 dark:border-gray-800/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <StudioCredit location="footer" />
          <StatusIndicator />
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/subscribe"
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Get the methodology field guide by email — one chapter a month
          </a>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
