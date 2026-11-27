import { ReactNode, useEffect, useLayoutEffect } from 'react';
import { removePrerender } from '../../utils/prerenderHandoff';
import SiteHeader from '../SiteHeader';
import SiteFooter from '../SiteFooter';
import { useFeatureFlag } from '../../stores/featureFlagsStore';

// useLayoutEffect warns under renderToStaticMarkup (build-time prerender).
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface PageShellProps {
  children: ReactNode;
  /** Hide the SiteHeader auth CTAs (used on /login). */
  hideAuthCtas?: boolean;
}

/**
 * Marketing-page wrapper. Renders SiteHeader + content + SiteFooter and
 * ensures the Tier 2 classes (.brand-v2 / .brand-v2-display) are on <html>
 * when the corresponding flags are enabled.
 *
 * The class binding also happens in main.tsx, but PageShell re-asserts it on
 * mount as a safety net for marketing routes — so we can later scope Tier 2
 * to marketing routes only by toggling the class in PageShell rather than
 * globally.
 */
export default function PageShell({ children, hideAuthCtas = false }: PageShellProps) {
  const inkOchre = useFeatureFlag('ink_ochre_palette');
  const fraunces = useFeatureFlag('fraunces_display');

  // Swap out the prerendered copy of this page in the same frame React's copy
  // is committed (see utils/prerenderHandoff.ts).
  useIsomorphicLayoutEffect(() => {
    removePrerender();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    html.classList.toggle('brand-v2', inkOchre);
    html.classList.toggle('brand-v2-display', fraunces);
  }, [inkOchre, fraunces]);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        Skip to main content
      </a>
      <SiteHeader hideAuthCtas={hideAuthCtas} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
