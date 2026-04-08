/**
 * QualCanvas Health Monitor — Cloudflare Worker Cron
 *
 * Runs every 5 minutes. Pings Railway backend /health endpoint.
 * Sends alert email via Resend API if backend is down.
 * Uses KV to track state and avoid alert flooding.
 */

interface Env {
  BACKEND_URL: string;
  FRONTEND_URL: string;
  ALERT_EMAIL: string;
  FROM_EMAIL: string;
  RESEND_API_KEY: string;
  HEALTH_KV: KVNamespace;
}

const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 min between alerts
const TIMEOUT_MS = 10_000; // 10 second timeout for health check

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const results = await Promise.allSettled([
      checkEndpoint(env.BACKEND_URL, 'Backend /health'),
      checkEndpoint(env.FRONTEND_URL, 'Frontend'),
    ]);

    const failures: string[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && !result.value.ok) {
        failures.push(`${result.value.name}: ${result.value.error}`);
      } else if (result.status === 'rejected') {
        failures.push(`Check failed: ${result.reason}`);
      }
    }

    if (failures.length > 0) {
      // Check cooldown
      const lastAlert = await env.HEALTH_KV.get('lastAlertSent');
      const lastAlertTime = lastAlert ? parseInt(lastAlert) : 0;

      if (Date.now() - lastAlertTime > ALERT_COOLDOWN_MS) {
        await sendAlert(env, failures);
        await env.HEALTH_KV.put('lastAlertSent', Date.now().toString());
        // Track consecutive failures
        const failCount = parseInt((await env.HEALTH_KV.get('consecutiveFailures')) || '0') + 1;
        await env.HEALTH_KV.put('consecutiveFailures', failCount.toString());
      }
    } else {
      // Reset failure counter on success
      const prevFailures = await env.HEALTH_KV.get('consecutiveFailures');
      if (prevFailures && parseInt(prevFailures) > 0) {
        // Send recovery notification
        await sendRecovery(env, parseInt(prevFailures));
        await env.HEALTH_KV.put('consecutiveFailures', '0');
      }
    }
  },

  // Also respond to HTTP requests for manual testing
  async fetch(request: Request, env: Env): Promise<Response> {
    const backendCheck = await checkEndpoint(env.BACKEND_URL, 'Backend');
    const frontendCheck = await checkEndpoint(env.FRONTEND_URL, 'Frontend');

    return Response.json({
      timestamp: new Date().toISOString(),
      backend: backendCheck,
      frontend: frontendCheck,
      allHealthy: backendCheck.ok && frontendCheck.ok,
    });
  },
};

async function checkEndpoint(
  url: string,
  name: string,
): Promise<{ ok: boolean; name: string; statusCode?: number; responseMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'QualCanvas-HealthMonitor/1.0' },
    });
    clearTimeout(timeout);

    const responseMs = Date.now() - start;

    if (response.ok) {
      return { ok: true, name, statusCode: response.status, responseMs };
    }
    return { ok: false, name, statusCode: response.status, responseMs, error: `HTTP ${response.status}` };
  } catch (err) {
    const responseMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, name, responseMs, error: message };
  }
}

async function sendAlert(env: Env, failures: string[]): Promise<void> {
  const body = {
    from: `QualCanvas Monitor <${env.FROM_EMAIL}>`,
    to: [env.ALERT_EMAIL],
    subject: `[QualCanvas DOWN] ${failures.length} health check(s) failing`,
    html: `
      <h2 style="color:#DC2626">Health Check Alert</h2>
      <p>The following QualCanvas services are not responding:</p>
      <ul>${failures.map((f) => `<li><strong>${f}</strong></li>`).join('')}</ul>
      <p>Checked at: ${new Date().toISOString()}</p>
      <p><small>Alerts are throttled to once per 30 minutes.</small></p>
    `,
  };

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function sendRecovery(env: Env, failCount: number): Promise<void> {
  const body = {
    from: `QualCanvas Monitor <${env.FROM_EMAIL}>`,
    to: [env.ALERT_EMAIL],
    subject: `[QualCanvas RECOVERED] Services back online`,
    html: `
      <h2 style="color:#16A34A">Services Recovered</h2>
      <p>All QualCanvas health checks are passing again.</p>
      <p>Duration: approximately ${failCount * 5} minutes of downtime.</p>
      <p>Recovered at: ${new Date().toISOString()}</p>
    `,
  };

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}
