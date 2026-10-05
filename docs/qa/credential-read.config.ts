import { defineConfig } from '@playwright/test';
import base from './account-read-engines.config';

export default defineConfig({
  ...base,
  testMatch: 'credential-read-recovery.spec.ts',
  outputDir: '../../test-results/credential-read',
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
