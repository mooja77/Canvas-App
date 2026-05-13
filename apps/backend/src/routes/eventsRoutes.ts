/**
 * Frontend telemetry ingestion endpoint.
 *
 * The frontend's `trackEvent(...)` fires gtag for GTM/GA4 and ALSO POSTs here
 * so the backend can:
 *   1. Forward selected events to the JMS admin-portal ingest endpoint
 *      (activation funnel: sign_up, first_canvas_created, first_code_added, etc.)
 *   2. Log auditable events that we want server-side proof of (upgrade_clicked,
 *      checkout_completed, etc.)
 *
 * Best-effort. Failures here do NOT crash the request — the frontend already
 * has the GTM signal as a backup.
 */

import { Router } from 'express';
import { z } from 'zod';
import { trackJmsEvent } from '../lib/jms-events.js';
import { validate } from '../middleware/validation.js';

export const eventsRoutes = Router();

const trackEventSchema = z.object({
  event: z.string().min(1).max(64),
  params: z.record(z.string(), z.unknown()).optional(),
});

// Events that get forwarded to JMS ingest. Frontend-only events (UI noise like
// activity_panel_opened) stay client-side.
const JMS_FORWARDED_EVENTS = new Set([
  'sign_up',
  'first_transcript_uploaded',
  'first_code_added',
  'first_ai_use',
  'first_excerpt_coded',
  'first_export',
  'upgrade_flow_initiated',
  'checkout_completed',
  'trial_activated',
  'trial_expired',
  'plan_limit_hit',
  'subscription_canceled',
  'team_member_invited',
  'team_member_joined',
  'canvas_shared',
]);

eventsRoutes.post('/events/track', validate(trackEventSchema), async (req, res) => {
  const { event, params = {} } = req.body as { event: string; params: Record<string, unknown> };

  // Attach the authenticated user's email if available so JMS can correlate.
  // We don't require auth here — anonymous events like `pricing_viewed` are
  // still useful.
  const email = (req as { userEmail?: string }).userEmail;

  if (JMS_FORWARDED_EVENTS.has(event)) {
    // fire-and-forget; do not await on the request-response path
    void trackJmsEvent({ name: event, email, properties: params });
  }

  res.status(204).end();
});
