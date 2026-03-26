import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../hooks/usePageMeta';

export default function NotFoundPage() {
  const { t } = useTranslation();
  usePageMeta('Page Not Found — QualCanvas', 'The page you are looking for does not exist.');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-brand-600 dark:text-brand-400 mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('notFound.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {t('notFound.message')}
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/"
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors"
          >
            {t('notFound.goHome')}
          </Link>
          <Link
            to="/canvas"
            className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t('notFound.openCanvas')}
          </Link>
        </div>
      </div>
    </div>
  );
}
