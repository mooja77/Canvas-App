import { defineConfig } from '@playwright/test';
import base from './memo-controls-engines.config';
export default defineConfig({
  ...base,
  testMatch: 'onboarding-activation.spec.ts',
  projects: [{ name: 'chromium', use: { browserName: 'chromium', channel: 'chrome' } }],
  webServer: undefined,
  outputDir: '../../test-results/onboarding-team-pointer-20261007',
});
