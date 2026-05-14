import { ReactNode, useEffect } from 'react';
import SiteHeader from '../SiteHeader';
import SiteFooter from '../SiteFooter';
import { useFeatureFlag } from '../../stores/featureFlagsStore';

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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    html.classList.toggle('brand-v2', inkOchre);
    html.classList.toggle('brand-v2-display', fraunces);
  }, [inkOchre, fraunces]);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      <SiteHeader hideAuthCtas={hideAuthCtas} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
