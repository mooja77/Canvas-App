import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '../../e2e',
  testMatch: 'notification-read-recovery.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 30000,
  outputDir: '../../test-results/notification-checklist-clearance-green',
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4751',
    browserName: 'chromium',
    channel: 'chrome',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: 'npm run preview -w apps/frontend -- --host 127.0.0.1 --port 4751 --strictPort',
    url: 'http://127.0.0.1:4751',
    reuseExistingServer: false,
  },
});
