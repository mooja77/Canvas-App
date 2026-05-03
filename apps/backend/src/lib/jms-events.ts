// 2026-05-03: Forward activation events to the JMS admin-portal so the
// Command Centre's ingest_events table reflects QualCanvas first-value
// rates. Reuses ADMIN_API_KEY (already in env) — that's the same value
// the admin-portal worker holds as ADMIN_KEY_QUALCANVAS secret. Best-
// effort; failures are logged but never thrown.

interface JmsEvent {
  name: string;
  email?: string;
  properties?: Record<string, unknown>;
}

const INGEST_URL = "https://admin.jmsdevlab.com/api/events/ingest";
const APP_ID = "qualcanvas";

export async function trackJmsEvent(event: JmsEvent): Promise<void> {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return; // soft-fail when key is not set
  try {
    const res = await fetch(INGEST_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-key": adminKey,
      },
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
