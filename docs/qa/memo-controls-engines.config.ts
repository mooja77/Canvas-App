import { defineConfig } from '@playwright/test';
import base from './memo-controls.config';

export default defineConfig({
  ...base,
  outputDir: '../../test-results/memo-title-engines',
  use: {
    baseURL: base.use?.baseURL,
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
