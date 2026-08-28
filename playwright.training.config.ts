import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Public-route and mocked-admin checks do not need the authenticated E2E
  // database. Keep these boundaries runnable against the production preview
  // even when Docker/Postgres is unavailable on a review machine.
  testDir: '.',
  testMatch: [
    /e2e-public[\\/]training\.spec\.ts$/,
    /e2e-public[\\/]admin-activation\.spec\.ts$/,
    /e2e[\\/]cookie-consent\.spec\.ts$/,
  ],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  // WebKit cold-starts slowly on some Windows hosts; assertions themselves
  // remain short, but allow the first navigation to complete reliably.
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'training-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'training-firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'training-webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'training-mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'training-mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run preview --workspace=@qualcanvas/frontend -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/training',
    reuseExistingServer: true,
    timeout: 90_000,
  },
});
