// Exact disposable targets, not a blanket "CI means safe" permission.
// This helper never connects and never includes a URL/credential in errors.
export function ownedAnalysisDatabase(env = process.env) {
  const databaseUrl = env.DATABASE_URL;
  let address;
  try {
    address = new URL(databaseUrl);
  } catch {
    throw new Error('Explicit owned fixture database required');
  }
  if (!['postgres:', 'postgresql:'].includes(address.protocol) || address.hash)
    throw new Error('Refusing any non-owned database');
  const approvedQuery = address.search === '' || address.search === '?schema=public';
  const localTargets = {
    '/qc_team_20261007': 'qc_team_20261007',
    '/qc_activation_20261005': 'qc_activation',
  };
  const ownedLocal =
    address.hostname === '127.0.0.1' &&
    address.port === '4759' &&
    approvedQuery &&
    Object.hasOwn(localTargets, address.pathname) &&
    address.username === localTargets[address.pathname];
  // Mirrors the ephemeral PostgreSQL service in .github/workflows/ci.yml.
  const ownedCi =
    env.GITHUB_ACTIONS === 'true' &&
    env.GITHUB_REPOSITORY === 'mooja77/Canvas-App' &&
    env.CI === 'true' &&
    env.E2E_TEST === 'true' &&
    address.hostname === 'localhost' &&
    address.port === '55432' &&
    address.pathname === '/qualcanvas_e2e' &&
    address.username === 'qualcanvas' &&
    address.password === 'qualcanvas' &&
    address.search === '?schema=public';
  if (!ownedLocal && !ownedCi) throw new Error('Refusing any non-owned database');
  return databaseUrl;
}
