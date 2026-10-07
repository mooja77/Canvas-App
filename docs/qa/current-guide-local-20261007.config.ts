import { defineConfig } from '@playwright/test';
import base from './memo-controls-engines.config';

export default defineConfig({
  ...base,
  testMatch: 'onboarding-guide.spec.ts',
  webServer: undefined,
  workers: 1,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
