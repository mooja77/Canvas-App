import { trackEvent } from '../../utils/analytics';

/**
 * Discreet "Built by JMS Dev Lab →" attribution that lives in the SiteFooter
 * bottom rail. Opens jmsdevlab.com/apps.html#qualcanvas in a new tab and
 * fires `studio_credit_clicked` for attribution measurement.
 *
 * Spec: docs/refresh/06-pages/14-site-footer.md
 * Design note: hairline ochre underline on hover only. Never a banner.
 */
export default function StudioCredit({ location = 'footer' }: { location?: 'footer' | 'colophon' }) {
  return (
    <a
      href="https://www.jmsdevlab.com/apps.html#qualcanvas"
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent('studio_credit_clicked', { location })}
      className="
        text-xs font-medium
        text-gray-500 dark:text-gray-400
        hover:text-gray-900 dark:hover:text-white
        hover:underline decoration-ochre-500 underline-offset-4 decoration-1
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        focus-visible:ring-brand-500
        rounded
        transition-colors duration-150
      "
    >
      Built by JMS Dev Lab →
    </a>
  );
}
