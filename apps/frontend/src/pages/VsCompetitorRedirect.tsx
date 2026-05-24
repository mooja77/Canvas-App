import { Navigate } from 'react-router-dom';

/**
 * The per-competitor comparison pages (/vs/nvivo, /vs/atlas-ti, …) are a planned
 * "Phase 3 follow-on" and aren't published yet (pending legal review — see
 * VsIndexPage). But the landing page and external/SEO links already point at
 * those URLs, so they 404'd. Until the full pages ship, redirect any
 * /vs/:competitor URL to the /vs index, which already carries the sourced
 * quick-verdict comparison for each competitor.
 */
export default function VsCompetitorRedirect() {
  return <Navigate to="/vs" replace />;
}
