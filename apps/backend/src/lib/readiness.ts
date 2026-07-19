export type ReadinessStatus = 'ready' | 'degraded' | 'not ready';

type ReadinessCheck = 'ok' | 'error' | 'skipped';

interface ReadinessSnapshot {
  status: ReadinessStatus;
  version: string;
  uptime: number;
  checks: Record<string, ReadinessCheck>;
  details: Record<string, string>;
}

/**
 * Keep public production probes intentionally opaque. The application still
 * performs every dependency check, but infrastructure names, configuration
 * state, versions, and process uptime are operational data rather than a
 * public API. Development and test environments retain the diagnostics that
 * make local troubleshooting useful.
 */
export function buildReadinessPayload(snapshot: ReadinessSnapshot, isProduction: boolean) {
  if (isProduction) return { status: snapshot.status };

  return {
    status: snapshot.status,
    version: snapshot.version,
    uptime: snapshot.uptime,
    checks: snapshot.checks,
    ...(Object.keys(snapshot.details).length > 0 ? { details: snapshot.details } : {}),
  };
}
