/**
 * Small green dot + "All systems operational" link in the SiteFooter bottom
 * rail. Links to status.qualcanvas.com (operated externally; see
 * docs/refresh/12-open-decisions.md #18 — buy Better Uptime / Instatus).
 *
 * Until the status page is live, this still degrades gracefully — the dot is
 * always green and the link works once the subdomain resolves.
 */
export default function StatusIndicator() {
  return (
    <a
      href="https://status.qualcanvas.com"
      target="_blank"
      rel="noopener noreferrer"
      className="
        inline-flex items-center gap-1.5
        text-xs font-medium
        text-gray-500 dark:text-gray-400
        hover:text-gray-900 dark:hover:text-white
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        focus-visible:ring-brand-500
        rounded
        transition-colors duration-150
      "
      aria-label="All systems operational — opens status.qualcanvas.com in a new tab"
    >
      <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <span className="hidden sm:inline">All systems operational</span>
      <span className="sm:hidden">Operational</span>
    </a>
  );
}
