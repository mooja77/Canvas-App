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
import { validate } from '../middleware/validation.js';

export const eventsRoutes = Router();

const trackEventSchema = z.object({
  event: z.string().min(1).max(64),
  params: z
    .record(z.string().max(64), z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]))
    .superRefine((value, context) => {
      if (Object.keys(value).length > 30) {
        context.addIssue({ code: 'custom', message: 'Too many event parameters' });
      }
    })
    .optional(),
});

eventsRoutes.post('/events/track', validate(trackEventSchema), async (req, res) => {
  // Browser telemetry remains in the consent-controlled analytics providers.
  // Trusted conversion/activation events are emitted by the server routes that
  // perform those actions; forwarding an unauthenticated browser claim would
  // let anyone forge business metrics.
  res.status(204).end();
});
