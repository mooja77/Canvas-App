import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import base from './account-read-engines.config';

export default defineConfig({
  ...base,
  outputDir: '../../test-results/account-read-dev',
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: 'npm run dev -w apps/frontend -- --host 127.0.0.1 --port 4751 --strictPort',
    url: 'http://127.0.0.1:4751',
    reuseExistingServer: false,
    env: { VITE_E2E: 'true', FRONTEND_PORT: '4751', FRONTEND_HOST: '127.0.0.1' },
  },
});
