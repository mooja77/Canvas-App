// 2026-05-03: Forward activation events to the JMS admin-portal so the
// Command Centre's ingest_events table reflects QualCanvas first-value
// rates. Reuses ADMIN_API_KEY (already in env) — that's the same value
// the admin-portal worker holds as ADMIN_KEY_QUALCANVAS secret. Best-
// effort; failures are logged but never thrown.

import { isTestAccountEmail } from '../utils/testAccounts.js';

interface JmsEvent {
  name: string;
  email?: string;
  properties?: Record<string, unknown>;
}

const INGEST_URL = 'https://admin.jmsdevlab.com/api/events/ingest';
const APP_ID = 'qualcanvas';

/**
 * Telemetry must never reach the production Command Centre from tests or CI.
 * Disabled when NODE_ENV=test, VITEST is set or CI is set, unless explicitly
 * enabled with JMS_TELEMETRY_ENABLED=1 (tests that stub fetch). 0 forces off.
 */
export function isTelemetryDisabled(env: Record<string, string | undefined> = process.env): boolean {
  const flag = String(env.JMS_TELEMETRY_ENABLED ?? '').toLowerCase();
  if (flag === '1' || flag === 'true') return false;
  if (flag === '0' || flag === 'false') return true;
  const ci = String(env.CI ?? '').toLowerCase();
  return env.NODE_ENV === 'test' || Boolean(env.VITEST) || (ci !== '' && ci !== '0' && ci !== 'false');
}

export async function trackJmsEvent(event: JmsEvent): Promise<void> {
  if (isTelemetryDisabled()) return;
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return; // soft-fail when key is not set
  try {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-key': adminKey,
      },
      signal: AbortSignal.timeout(4000),
      body: JSON.stringify({
        app_id: APP_ID,
        events: [
          {
            name: event.name,
            email: event.email,
            properties: event.properties ?? {},
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(`[jms-events] ingest ${event.name} failed: ${res.status}`);
    }
  } catch (err) {
    console.warn(`[jms-events] ingest ${event.name} threw:`, err);
  }
}

/**
 * A funnel milestone for one researcher (sign-up, first value). Test, demo,
 * smoke and internal accounts are dropped here, before anything leaves the
 * server, using the same predicate as every admin count: a milestone the
 * Command Centre cannot attribute to a real address must not reach it.
 */
export async function trackActivationEvent(
  name: 'sign_up' | 'first_value_reached',
  email: string | null | undefined,
  properties: Record<string, unknown>,
): Promise<void> {
  if (isTestAccountEmail(email)) return;
  await trackJmsEvent({ name, email: email ?? undefined, properties });
}
