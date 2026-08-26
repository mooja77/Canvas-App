import { describe, expect, it } from 'vitest';
import { remapComputedConfig } from './cloneConfig.js';

const maps = {
  transcript: new Map([
    ['t1', 'new-t1'],
    ['t2', 'new-t2'],
  ]),
  question: new Map([
    ['q1', 'new-q1'],
    ['q2', 'new-q2'],
  ]),
  case: new Map([['c1', 'new-c1']]),
};

describe('remapComputedConfig', () => {
  it('remaps scalar, array, scoped and nested condition IDs', () => {
    const result = JSON.parse(
      remapComputedConfig(
        JSON.stringify({
          transcriptId: 't1',
          transcriptIds: ['t1', 't2'],
          questionIds: ['q1', 'q2'],
          caseIds: ['c1'],
          scope: 'question',
          scopeId: 'q2',
          conditions: [{ questionId: 'q1', operator: 'AND' }],
        }),
        maps,
      ),
    );
    expect(result).toMatchObject({
      transcriptId: 'new-t1',
      transcriptIds: ['new-t1', 'new-t2'],
      questionIds: ['new-q1', 'new-q2'],
      caseIds: ['new-c1'],
      scopeId: 'new-q2',
      conditions: [{ questionId: 'new-q1', operator: 'AND' }],
    });
  });
});
