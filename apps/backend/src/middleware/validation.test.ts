import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  validate,
  createCanvasSchema,
  createTranscriptSchema,
  createCodingSchema,
  createRelationSchema,
  createComputedNodeSchema,
  autoCodeSchema,
  saveLayoutSchema,
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
      mw(
        mockReq({ fromType: 'memo', fromId: 'c1', toType: 'question', toId: 'q1', label: 'x' }),
        res,
        next,
      );
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
      const types = ['search', 'cooccurrence', 'matrix', 'stats', 'comparison', 'wordcloud', 'cluster', 'codingquery', 'sentiment', 'treemap'];
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
