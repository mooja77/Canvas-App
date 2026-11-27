import { describe, it, expect } from 'vitest';
import { PLAN_LIMITS, PUBLISHED_PRICES_USD, formatUsdAmount, getPlanLimits, planLabel } from '@qualcanvas/shared';
import { deriveQualcanvasPlan } from '../../routes/billingRoutes.js';

describe('QualCanvas Solo $9.99 plan and existing-customer preservation', () => {
  it('defines Solo $9.99 monthly / $99 annual with exact audit entitlements', () => {
    expect(PUBLISHED_PRICES_USD.solo).toEqual({ monthly: 9.99, annual: 99 });
    expect(formatUsdAmount(PUBLISHED_PRICES_USD.solo.monthly)).toBe('9.99');
    expect(planLabel('solo')).toBe('Solo');

    const solo = getPlanLimits('solo');
    expect(solo.maxCanvases).toBe(5);
    expect(solo.maxTranscriptsPerCanvas).toBe(Infinity);
    expect(solo.maxWordsPerTranscript).toBe(50000);
    expect(solo.maxCodes).toBe(Infinity);
    expect(solo.allowedAnalysisTypes).toHaveLength(13);
    expect(solo.aiEnabled).toBe(true);
    expect(solo.allowedExportFormats).toEqual(expect.arrayContaining(['csv', 'docx', 'xlsx', 'md', 'html', 'png']));
    // Pro keeps QDPX, share codes, unlimited canvases, and unlimited free viewers
    expect(solo.allowedExportFormats).not.toContain('qdpx');
    expect(solo.maxShares).toBe(0);
    expect(solo.maxCollaborators).toBe(0);
    expect(solo.intercoderEnabled).toBe(false);
  });

  it('preserves every existing plan and published price unchanged', () => {
    expect(PUBLISHED_PRICES_USD.student).toEqual({ monthly: 5, annual: 48 });
    expect(PUBLISHED_PRICES_USD.pro).toEqual({ monthly: 15, annual: 144 });
    expect(PUBLISHED_PRICES_USD.team).toEqual({ monthly: 39, annual: 384 });

    expect(PLAN_LIMITS.free.maxCanvases).toBe(2);
    expect(PLAN_LIMITS.free.maxTranscriptsPerCanvas).toBe(5);
    expect(PLAN_LIMITS.free.maxCodes).toBe(10);
    expect(PLAN_LIMITS.student.maxCanvases).toBe(5);
    expect(PLAN_LIMITS.student.maxShares).toBe(2);
    expect(PLAN_LIMITS.pro.maxCanvases).toBe(Infinity);
    expect(PLAN_LIMITS.pro.maxShares).toBe(5);
    expect(PLAN_LIMITS.pro.allowedExportFormats).toContain('qdpx');
    expect(PLAN_LIMITS.team.intercoderEnabled).toBe(true);
    expect(PLAN_LIMITS.team.maxCoders).toBe(Infinity);
  });

  it('resolves Solo from Stripe metadata and product name without affecting existing tiers', async () => {
    const fakeStripe = {} as Parameters<typeof deriveQualcanvasPlan>[0];

    expect(
      await deriveQualcanvasPlan(fakeStripe, {
        metadata: { app: 'qualcanvas', plan: 'solo' },
      }),
    ).toBe('solo');

    expect(
      await deriveQualcanvasPlan(fakeStripe, {
        metadata: {},
        product: { name: 'QualCanvas Solo' },
      }),
    ).toBe('solo');

    expect(
      await deriveQualcanvasPlan(fakeStripe, {
        metadata: { app: 'qualcanvas', plan: 'pro' },
      }),
    ).toBe('pro');
  });
});
