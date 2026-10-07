import { defineConfig } from '@playwright/test';
import base from './memo-controls-engines.config';
export default defineConfig({
  ...base,
  testMatch: 'analysis-setup-onboarding.spec.ts',
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: undefined,
  outputDir: '../../test-results/analysis-setup-local-20261007',
});
