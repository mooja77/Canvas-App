import { defineConfig } from '@playwright/test';
import base from './memo-controls-engines.config';
const origin = process.env.QUALCANVAS_TEAM_QA_ORIGIN ?? String(base.use?.baseURL);
if (!['http://localhost:4751', 'https://qualcanvas.com'].includes(origin))
  throw new Error('Only owned preview or canonical read-only fixture verification allowed');
export default defineConfig({
  ...base,
  testMatch: ['team-action-recovery.spec.ts', 'team-read-recovery.spec.ts'],
  webServer: undefined,
  use: { ...base.use, baseURL: origin },
  outputDir: '../../test-results/team-actions-20261007',
});
