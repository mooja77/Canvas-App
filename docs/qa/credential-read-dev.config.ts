import { defineConfig } from '@playwright/test';
import dev from './account-read-dev.config';
import preview from './credential-read.config';

export default defineConfig({
  ...preview,
  outputDir: '../../test-results/credential-read-dev',
  webServer: dev.webServer,
});
