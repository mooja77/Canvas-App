import { defineConfig } from '@playwright/test';
import base from './memo-controls-engines.config';

export default defineConfig({
  ...base,
  testMatch: 'account-read-recovery.spec.ts',
  outputDir: '../../test-results/account-read-engines',
});
