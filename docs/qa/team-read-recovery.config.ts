import { defineConfig } from '@playwright/test';
import base from './memo-controls-engines.config';
export default defineConfig({
  ...base,
  testMatch: 'team-read-recovery.spec.ts',
  webServer: undefined,
  outputDir: '../../test-results/team-read-recovery-20261005',
});
