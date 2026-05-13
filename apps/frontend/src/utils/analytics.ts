type Gtag = (command: 'event', eventName: string, params?: Record<string, unknown>) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

/**
 * Catalogue of analytics events. Adding a name here enforces it everywhere
 * (TypeScript will narrow `trackEvent` calls to known events). Keep this list
 * in sync with `docs/implementation/03_sprint_b_voice_telemetry.md`.
 */
export type AnalyticsEvent =
  // Existing
  | 'login'
  | 'sign_up'
  | 'pricing_viewed'
  // Activation funnel
  | 'first_transcript_uploaded'
  | 'first_code_added'
  | 'first_ai_use'
  | 'first_excerpt_coded'
  | 'first_export'
  // Conversion funnel
  | 'upgrade_flow_initiated'
  | 'checkout_completed'
  | 'trial_activated'
  | 'trial_expired'
  | 'plan_limit_hit'
  | 'subscription_canceled'
  // Collaboration
  | 'team_member_invited'
  | 'team_member_joined'
  | 'canvas_shared'
  // AI moments
  | 'ai_moment_triggered'
  | 'inline_ai_triggered'
  | 'inline_ai_accepted'
  | 'inline_ai_rejected'
  | 'inline_ai_new_code'
  | 'inline_ai_cache_hit'
  // Reliability
  | 'service_worker_update_available'
  // Onboarding
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_skipped'
  | 'onboarding_completed_seconds'
  | 'template_selected'
  // Discoverability
  | 'cmdk_search_query'
  | 'cmdk_search_no_results'
  | 'activity_panel_opened'
  | 'feature_flag_exposed'
  | 'feature_flag_changed';

export function trackEvent(eventName: AnalyticsEvent, params?: Record<string, unknown>) {
  // GTM / GA4 via gtag
  window.gtag?.('event', eventName, params);

  // Best-effort forward to backend for JMS ingest (no-op if 404 or auth missing)
  // We don't await this — it's fire-and-forget. The backend will write to
  // AuditLog and forward to the JMS portal where applicable.
  if (typeof fetch !== 'undefined') {
    fetch('/api/v1/events/track', {
      method: 'POST',
      body: JSON.stringify({ event: eventName, params: params || {} }),
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }).catch(() => {
      // Silent failure. Analytics is best-effort.
    });
  }
}
