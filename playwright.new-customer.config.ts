import { defineConfig, devices } from '@playwright/test';
import fullstack from './playwright.fullstack.config';

// Reuse the real guarded database/backend stack, with the existing full
// activation journey. No accounts or test data are written to production.
export default defineConfig({
  ...fullstack,
  testDir: './e2e',
  testMatch: /onboarding-activation\.spec\.ts/,
  use: {
    ...fullstack.use,
    ...(process.env.E2E_CHROMIUM ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM } } : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
});
