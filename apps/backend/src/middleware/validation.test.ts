import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  validate,
  createCanvasSchema,
  createTranscriptSchema,
  createCanvasQuestionSchema,
  createCodingSchema,
  createRelationSchema,
  createComputedNodeSchema,
  autoCodeSchema,
  saveLayoutSchema,
  updateCanvasQuestionSchema,
  canvasDetailQuerySchema,
  onboardingPatchBodySchema,
  ONBOARDING_CHECKLIST_TASK_IDS,
} from './validation.js';

function mockReq(body: unknown): Request {
  return { body } as Request;
}

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('validate middleware', () => {
  const next: NextFunction = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('createCanvasSchema', () => {
    const mw = validate(createCanvasSchema);

    it('passes valid canvas data', () => {
      const req = mockReq({ name: 'My Canvas' });
      mw(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.body).toEqual({ name: 'My Canvas' });
    });

    it('passes with optional description', () => {
      const req = mockReq({ name: 'Test', description: 'A description' });
      mw(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects empty name', () => {
      const res = mockRes();
      mw(mockReq({ name: '' }), res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'Validation failed' }));
    });

    it('rejects missing name', () => {
      const res = mockRes();
      mw(mockReq({}), res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects name over 200 chars', () => {
      const res = mockRes();
      mw(mockReq({ name: 'a'.repeat(201) }), res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createTranscriptSchema', () => {
    const mw = validate(createTranscriptSchema);

    it('passes valid transcript', () => {
      const req = mockReq({ title: 'Interview 1', content: 'Some content here' });
      mw(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects missing content', () => {
      const res = mockRes();
      mw(mockReq({ title: 'Title' }), res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createCodingSchema', () => {
    const mw = validate(createCodingSchema);

    it('passes valid coding', () => {
      const req = mockReq({
        transcriptId: 'tx1',
        questionId: 'q1',
        startOffset: 0,
        endOffset: 10,
        codedText: 'hello world',
      });
      mw(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects negative startOffset', () => {
      const res = mockRes();
      mw(
        mockReq({
          transcriptId: 'tx1',
          questionId: 'q1',
          startOffset: -1,
          endOffset: 10,
          codedText: 'text',
        }),
        res,
        next,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects zero endOffset', () => {
      const res = mockRes();
      mw(
        mockReq({
          transcriptId: 'tx1',
          questionId: 'q1',
          startOffset: 0,
          endOffset: 0,
          codedText: 'text',
        }),
        res,
        next,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createRelationSchema', () => {
    const mw = validate(createRelationSchema);

    it('passes valid relation', () => {
      const req = mockReq({
        fromType: 'case',
        fromId: 'c1',
        toType: 'question',
        toId: 'q1',
        label: 'related to',
      });
      mw(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects invalid fromType enum', () => {
      const res = mockRes();
      mw(mockReq({ fromType: 'memo', fromId: 'c1', toType: 'question', toId: 'q1', label: 'x' }), res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createComputedNodeSchema', () => {
    const mw = validate(createComputedNodeSchema);

    it('passes valid computed node', () => {
      const req = mockReq({ nodeType: 'search', label: 'My search' });
      mw(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects invalid nodeType', () => {
      const res = mockRes();
      mw(mockReq({ nodeType: 'invalid', label: 'test' }), res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('accepts all 10 node types', () => {
      const types = [
        'search',
        'cooccurrence',
        'matrix',
        'stats',
        'comparison',
        'wordcloud',
        'cluster',
        'codingquery',
        'sentiment',
        'treemap',
      ];
      for (const nodeType of types) {
        vi.resetAllMocks();
        const req = mockReq({ nodeType, label: 'test' });
        mw(req, mockRes(), next);
        expect(next).toHaveBeenCalled();
      }
    });
  });

  describe('autoCodeSchema', () => {
    const mw = validate(autoCodeSchema);

    it('passes valid auto-code config', () => {
      const req = mockReq({ questionId: 'q1', pattern: 'test', mode: 'keyword' });
      mw(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects invalid mode', () => {
      const res = mockRes();
      mw(mockReq({ questionId: 'q1', pattern: 'test', mode: 'fuzzy' }), res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('saveLayoutSchema', () => {
    const mw = validate(saveLayoutSchema);

    it('passes valid layout', () => {
      const req = mockReq({
        positions: [{ nodeId: 'n1', nodeType: 'question', x: 100, y: 200 }],
      });
      mw(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('passes empty positions array', () => {
      const req = mockReq({ positions: [] });
      mw(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('strips extra fields from validated data', () => {
      const req = mockReq({
        positions: [{ nodeId: 'n1', nodeType: 'q', x: 0, y: 0 }],
        extraField: 'should be removed',
      });
      mw(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.body.extraField).toBeUndefined();
    });
  });
});

/**
 * Whitespace-only input was accepted where empty input is correctly rejected:
 * `z.string().min(1)` counts "   " as length 3. A whitespace-only transcript
 * was created, rendered as an empty 0-word node, and consumed a plan slot.
 * `.trim()` before `.min(1)` rejects it and normalises what gets stored.
 */
describe('whitespace-only input is rejected like empty input', () => {
  const blank = ['   ', '\t\t', '\n\n', ' \t\n '];

  it('rejects whitespace-only transcript content and title', () => {
    for (const w of blank) {
      expect(createTranscriptSchema.safeParse({ title: 'T', content: w }).success).toBe(false);
      expect(createTranscriptSchema.safeParse({ title: w, content: 'real content' }).success).toBe(false);
    }
  });

  it('rejects a whitespace-only code name', () => {
    for (const w of blank) {
      expect(createCanvasQuestionSchema.safeParse({ text: w }).success).toBe(false);
    }
  });

  it('trims the title but leaves content byte-for-byte', () => {
    // Content must NOT be trimmed: coding offsets are computed by the client
    // against the exact string it holds, and the server enforces
    // content.slice(start, end) === codedText. Rewriting the text server-side
    // shifts every offset - a coding at the very end started failing with 400
    // when this briefly used .trim().
    const parsed = createTranscriptSchema.safeParse({ title: '  Interview 1  ', content: '  real words  ' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe('Interview 1');
      expect(parsed.data.content).toBe('  real words  ');
    }
  });

  it('keeps trailing whitespace usable as a coding target', () => {
    const content = 'The waiting was the hardest part.   ';
    const parsed = createTranscriptSchema.safeParse({ title: 'T', content });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // The invariant the coding endpoint enforces still holds at the very end.
      expect(parsed.data.content.slice(content.length - 10, content.length)).toBe(content.slice(-10));
    }
  });
});

/**
 * The create schema omitted parentQuestionId, and zod strips undeclared keys
 * before the route ever sees req.body — so a code created as a child of a theme
 * silently became a top-level code. The update schema always accepted it, so
 * the two disagreed about the same field.
 */
describe('createCanvasQuestionSchema keeps parentQuestionId', () => {
  it('preserves a parent id instead of silently dropping it', () => {
    const parsed = createCanvasQuestionSchema.safeParse({ text: 'Sub-code', parentQuestionId: 'q-parent' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.parentQuestionId).toBe('q-parent');
  });

  it('accepts null for an explicitly top-level code', () => {
    const parsed = createCanvasQuestionSchema.safeParse({ text: 'Top level', parentQuestionId: null });
    expect(parsed.success).toBe(true);
  });

  it('is still optional', () => {
    expect(createCanvasQuestionSchema.safeParse({ text: 'No parent' }).success).toBe(true);
  });
});

/**
 * L1 (bug hunt 2026-09-02): `parentQuestionId: ''` passed z.string() and hit
 * the foreign key as P2003 -> 500 on both create and update. The empty string
 * means "no parent": it is coerced to null. Anything that is not id-shaped
 * (spaces, slashes, objects) is a 400 instead of a Prisma error.
 */
describe('parentQuestionId is a cuid-shaped id or null (L1)', () => {
  it.each([
    ['create', createCanvasQuestionSchema, { text: 'Code' }],
    ['update', updateCanvasQuestionSchema, {}],
  ] as const)('%s: coerces the empty string to null', (_label, schema, base) => {
    const parsed = schema.safeParse({ ...base, parentQuestionId: '' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.parentQuestionId).toBeNull();
  });

  it.each([
    ['create', createCanvasQuestionSchema, { text: 'Code' }],
    ['update', updateCanvasQuestionSchema, {}],
  ] as const)('%s: rejects ids that are not id-shaped', (_label, schema, base) => {
    for (const bad of ['has space', 'a/b', 'x'.repeat(65), 42, { id: 'q1' }, ['q1']]) {
      expect(schema.safeParse({ ...base, parentQuestionId: bad }).success).toBe(false);
    }
  });

  it('still accepts a real cuid, null and undefined', () => {
    expect(updateCanvasQuestionSchema.safeParse({ parentQuestionId: 'cmf1x2y3z0000abcdefghijkl' }).success).toBe(true);
    expect(updateCanvasQuestionSchema.safeParse({ parentQuestionId: null }).success).toBe(true);
    expect(updateCanvasQuestionSchema.safeParse({}).success).toBe(true);
  });
});

/**
 * L2: GET /canvas/:id detail paging used parseInt + clamp, so
 * `detailPage=99999999999999999999` reached Prisma as an unencodable `skip`
 * (500) and `detailPage=abc` silently became page 0.
 */
describe('canvasDetailQuerySchema (L2)', () => {
  it('accepts absent, empty and in-range values', () => {
    expect(canvasDetailQuerySchema.safeParse({})).toEqual({ success: true, data: {} });
    expect(canvasDetailQuerySchema.safeParse({ detailPage: '', detailPageSize: '' })).toEqual({
      success: true,
      data: {},
    });
    expect(canvasDetailQuerySchema.safeParse({ detailPage: '3', detailPageSize: '500' })).toEqual({
      success: true,
      data: { detailPage: 3, detailPageSize: 500 },
    });
    expect(canvasDetailQuerySchema.safeParse({ detailPage: '1000000', detailPageSize: '1000' }).success).toBe(true);
    expect(canvasDetailQuerySchema.safeParse({ detailPage: '0', detailPageSize: '50' }).success).toBe(true);
  });

  it.each([
    ['overflowing page', { detailPage: '99999999999999999999' }],
    ['page above the ceiling', { detailPage: '1000001' }],
    ['negative page', { detailPage: '-1' }],
    ['fractional page', { detailPage: '1.5' }],
    ['non-numeric page', { detailPage: 'abc' }],
    ['repeated page param', { detailPage: ['1', '2'] }],
    ['page size below the floor', { detailPageSize: '10' }],
    ['page size above the ceiling', { detailPageSize: '1001' }],
    ['non-numeric page size', { detailPageSize: 'lots' }],
  ])('rejects %s', (_label, query) => {
    expect(canvasDetailQuerySchema.safeParse(query).success).toBe(false);
  });
});

/**
 * L4: PATCH /user/onboarding stored whatever it was sent (unknown ids,
 * `__proto__`, arrays for scalars). The body schema is strict.
 */
describe('onboardingPatchBodySchema (L4)', () => {
  it('accepts every key the frontend actually sends', () => {
    const parsed = onboardingPatchBodySchema.safeParse({
      state: {
        currentStep: 2,
        startedAt: '2026-09-02T10:00:00.000Z',
        dismissedTooltips: ['tip-a', 'tip-b'],
        checklistComplete: ['first-transcript', 'export-csv', 'dismissed'],
        completionMode: 'skipped',
        completedAtClient: '2026-09-02T10:05:00+01:00',
        templateChoice: { id: 'tmpl-1', name: 'Interviews' },
        personalization: { researchTopic: 'burnout', method: 'interviews', solo: true },
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a null templateChoice and an empty state', () => {
    expect(onboardingPatchBodySchema.safeParse({ state: { templateChoice: null } }).success).toBe(true);
    expect(onboardingPatchBodySchema.safeParse({ state: {} }).success).toBe(true);
  });

  it.each([
    ['an unknown top-level key', { state: { currentStep: 1 }, extra: true }],
    ['an unknown state key', { state: { favouriteColour: 'blue' } }],
    ['a __proto__ key', JSON.parse('{"state":{"__proto__":{"polluted":true}}}')],
    ['a checklist id that is not a task', { state: { checklistComplete: ['made-up'] } }],
    ['a checklist that is not an array', { state: { checklistComplete: 'export-csv' } }],
    ['a negative step', { state: { currentStep: -1 } }],
    ['a step above 50', { state: { currentStep: 51 } }],
    ['a fractional step', { state: { currentStep: 1.5 } }],
    ['a string step', { state: { currentStep: '2' } }],
    ['an unknown completion mode', { state: { completionMode: 'abandoned' } }],
    [
      'more than 100 dismissed tooltips',
      { state: { dismissedTooltips: Array.from({ length: 101 }, (_, i) => `t${i}`) } },
    ],
    ['a tooltip id over 64 chars', { state: { dismissedTooltips: ['x'.repeat(65)] } }],
    ['a non-ISO startedAt', { state: { startedAt: 'yesterday' } }],
    ['a missing state', {}],
    ['a non-object state', { state: 'done' }],
  ])('rejects %s', (_label, body) => {
    expect(onboardingPatchBodySchema.safeParse(body).success).toBe(false);
  });

  it('lists exactly the checklist task ids the frontend renders', () => {
    expect([...ONBOARDING_CHECKLIST_TASK_IDS]).toEqual([
      'first-transcript',
      'first-coded-excerpt',
      'create-theme',
      'run-analysis',
      'export-csv',
      'dismissed',
    ]);
  });
});
