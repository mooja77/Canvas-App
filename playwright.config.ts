import { defineConfig, devices } from '@playwright/test';

const defaultE2eDatabaseUrl = 'postgresql://qualcanvas:qualcanvas@localhost:55432/qualcanvas_e2e?schema=public';
const e2eDatabaseUrl = process.env.DATABASE_URL?.startsWith('postgres')
  ? process.env.DATABASE_URL
  : defaultE2eDatabaseUrl;
const e2eJwtSecret = process.env.JWT_SECRET ?? 'qualcanvas-e2e-secret';
const e2eBackendPort = Number(process.env.E2E_BACKEND_PORT ?? 3007);
const e2eFrontendPort = Number(process.env.E2E_FRONTEND_PORT ?? 5174);
// Keep the browser origin on localhost because persisted auth state and older
// specs use that origin. Probe the explicitly-bound IPv4 listener separately
// so CI does not depend on how its runner resolves localhost.
const e2eBaseUrl = `http://localhost:${e2eFrontendPort}`;
const e2eFrontendProbeUrl = `http://127.0.0.1:${e2eFrontendPort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 30000,
  use: {
    baseURL: e2eBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Setup project — authenticates once and saves state
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Main tests — reuse authenticated state (default, runs with `npm run test:e2e`)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Cross-browser projects — run explicitly with `--project firefox` etc.
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Mobile viewports — run explicitly with `--project mobile-chrome` etc.
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 13'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'npm run build -w shared && npm run dev:backend',
      url: `http://127.0.0.1:${e2eBackendPort}/ready`,
      reuseExistingServer: true,
      timeout: 180000,
      env: {
        DATABASE_URL: e2eDatabaseUrl,
        E2E_TEST: 'true',
        JWT_SECRET: e2eJwtSecret,
        PORT: String(e2eBackendPort),
      },
    },
    {
      command: 'npm run dev:frontend',
      url: e2eFrontendProbeUrl,
      reuseExistingServer: true,
      timeout: 180000,
      env: {
        VITE_E2E: 'true',
        FRONTEND_PORT: String(e2eFrontendPort),
        FRONTEND_HOST: '127.0.0.1',
        BACKEND_URL: `http://127.0.0.1:${e2eBackendPort}`,
      },
    },
  ],
});
