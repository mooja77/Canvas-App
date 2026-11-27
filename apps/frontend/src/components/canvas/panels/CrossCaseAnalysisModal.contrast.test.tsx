import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('CrossCaseAnalysisModal heatmap cell contrast', () => {
  it('keeps max heatmap background tint <= 0.20 alpha and uses high-contrast text-gray-900', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/canvas/panels/CrossCaseAnalysisModal.tsx'), 'utf8');
    expect(src).not.toContain('0.08 + intensity * 0.35');
    expect(src).toContain('0.06 + intensity * 0.14');
    expect(src).toContain('className="min-h-8 cursor-pointer text-gray-900 dark:text-gray-100"');
    expect(src).toContain('className="max-w-48 whitespace-normal break-words text-gray-900 dark:text-gray-100"');
  });
});
