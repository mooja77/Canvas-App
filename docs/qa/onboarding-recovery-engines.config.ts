import { defineConfig } from '@playwright/test';
import base from './memo-controls-engines.config';

export default defineConfig({
  ...base,
  testMatch: ['memo-controls.spec.ts', 'account-read-recovery.spec.ts'],
  outputDir: '../../test-results/onboarding-recovery-engines',
});
