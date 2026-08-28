import { describe, expect, it } from 'vitest';
import { buildActivationFunnel } from './activationFunnel.js';

const start = new Date('2026-08-01T00:00:00.000Z');
const afterHours = (hours: number) => new Date(start.getTime() + hours * 3_600_000);

describe('buildActivationFunnel', () => {
  it('returns an empty, non-misleading funnel when the cohort is empty', () => {
    expect(buildActivationFunnel([], { canvas: [], transcript: [], coding: [] })).toEqual({
      cohortSize: 0,
      activatedUsers: 0,
      activationRate: null,
      stages: [
        {
          key: 'signup',
          label: 'Signed up',
          users: 0,
          cohortRate: null,
          previousStepRate: null,
          medianHoursToReach: null,
        },
        {
          key: 'canvas',
          label: 'Created a project',
          users: 0,
          cohortRate: null,
          previousStepRate: null,
          medianHoursToReach: null,
        },
        {
          key: 'transcript',
          label: 'Added a transcript',
          users: 0,
          cohortRate: null,
          previousStepRate: null,
          medianHoursToReach: null,
        },
        {
          key: 'coding',
          label: 'Created a first coding',
          users: 0,
          cohortRate: null,
          previousStepRate: null,
          medianHoursToReach: null,
        },
      ],
    });
  });

  it('deduplicates milestones, ignores users outside the cohort and reports median time', () => {
    const result = buildActivationFunnel(
      [
        { id: 'u1', createdAt: start },
        { id: 'u2', createdAt: start },
      ],
      {
        canvas: [
          { userId: 'u1', createdAt: afterHours(3) },
          { userId: 'u1', createdAt: afterHours(2) },
          { userId: 'u2', createdAt: afterHours(4) },
          { userId: 'outside', createdAt: afterHours(1) },
          { userId: null, createdAt: afterHours(1) },
        ],
        transcript: [{ userId: 'u1', createdAt: afterHours(6) }],
        coding: [{ userId: 'u1', createdAt: afterHours(8) }],
      },
    );

    expect(result).toMatchObject({ cohortSize: 2, activatedUsers: 1, activationRate: 50 });
    expect(result.stages).toEqual([
      {
        key: 'signup',
        label: 'Signed up',
        users: 2,
        cohortRate: 100,
        previousStepRate: 100,
        medianHoursToReach: 0,
      },
      {
        key: 'canvas',
        label: 'Created a project',
        users: 2,
        cohortRate: 100,
        previousStepRate: 100,
        medianHoursToReach: 3,
      },
      {
        key: 'transcript',
        label: 'Added a transcript',
        users: 1,
        cohortRate: 50,
        previousStepRate: 50,
        medianHoursToReach: 6,
      },
      {
        key: 'coding',
        label: 'Created a first coding',
        users: 1,
        cohortRate: 50,
        previousStepRate: 100,
        medianHoursToReach: 8,
      },
    ]);
  });

  it('clamps impossible pre-signup milestone timestamps to zero hours', () => {
    const result = buildActivationFunnel([{ id: 'u1', createdAt: start }], {
      canvas: [{ userId: 'u1', createdAt: afterHours(-1) }],
      transcript: [],
      coding: [],
    });

    expect(result.stages[1]?.medianHoursToReach).toBe(0);
  });
});
