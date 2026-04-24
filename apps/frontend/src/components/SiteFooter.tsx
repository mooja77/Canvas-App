import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';

/**
 * Shared footer used across the marketing surface.
 *
 * Four navigational sections plus a copyright row. No social links until
 * we have real URLs to point at — a broken or placeholder social icon
 * would be worse than none.
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
                    to="/login"
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
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            Company
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                href="https://www.jmsdevlab.com/"
                target="_blank"
                rel="noopener"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                JMS Dev Lab
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-gray-200/70 dark:border-gray-800/70 text-xs text-gray-500 dark:text-gray-500">
        <span>&copy; {new Date().getFullYear()} QualCanvas. All rights reserved.</span>
        <span>Built for qualitative researchers</span>
      </div>
    </footer>
  );
}
