import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}

// ─── Coding Canvas Schemas ───

export const createCanvasSchema = z.object({
  name: z.string().min(1, 'Canvas name is required').max(200),
  description: z.string().max(1000).optional(),
});

export const updateCanvasSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

export const createTranscriptSchema = z.object({
  title: z.string().min(1, 'Transcript title is required').max(200),
  content: z.string().min(1, 'Transcript content is required'),
  sourceType: z.string().max(50).optional(),
  sourceId: z.string().max(200).optional(),
});

export const importNarrativesSchema = z.object({
  narratives: z.array(z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    sourceType: z.string().max(50).optional(),
    sourceId: z.string().max(200).optional(),
  })).min(1).max(100),
});

export const importFromCanvasSchema = z.object({
  sourceCanvasId: z.string().min(1),
  transcriptIds: z.array(z.string().min(1)).min(1, 'At least one transcript ID is required').max(100),
});

export const updateTranscriptSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  caseId: z.string().nullable().optional(),
});

export const createCanvasQuestionSchema = z.object({
  text: z.string().min(1, 'Question text is required').max(1000),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const updateCanvasQuestionSchema = z.object({
  text: z.string().min(1).max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  parentQuestionId: z.string().nullable().optional(),
});

export const createCanvasMemoSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1, 'Memo content is required').max(5000),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const updateCanvasMemoSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const createCodingSchema = z.object({
  transcriptId: z.string().min(1),
  questionId: z.string().min(1),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(1),
  codedText: z.string().min(1),
  note: z.string().max(2000).optional(),
});

export const saveLayoutSchema = z.object({
  positions: z.array(z.object({
    nodeId: z.string().min(1),
    nodeType: z.string().min(1),
    x: z.number(),
    y: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
    collapsed: z.boolean().optional(),
  })),
});

export const reassignCodingSchema = z.object({
  newQuestionId: z.string().min(1),
});

export const updateCodingSchema = z.object({
  annotation: z.string().max(5000).nullable().optional(),
});

export const createCaseSchema = z.object({
  name: z.string().min(1, 'Case name is required').max(200),
  attributes: z.record(z.string(), z.string()).optional(),
});

export const updateCaseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  attributes: z.record(z.string(), z.string()).optional(),
});

export const createRelationSchema = z.object({
  fromType: z.enum(['case', 'question']),
  fromId: z.string().min(1),
  toType: z.enum(['case', 'question']),
  toId: z.string().min(1),
  label: z.string().min(1).max(200),
});

export const updateRelationSchema = z.object({
  label: z.string().min(1).max(200),
});

export const createComputedNodeSchema = z.object({
  nodeType: z.enum(['search', 'cooccurrence', 'matrix', 'stats', 'comparison', 'wordcloud', 'cluster', 'codingquery', 'sentiment', 'treemap']),
  label: z.string().min(1).max(200),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const mergeQuestionsSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
});

export const updateComputedNodeSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const autoCodeSchema = z.object({
  questionId: z.string().min(1),
  pattern: z.string().min(1).max(500),
  mode: z.enum(['keyword', 'regex']),
  transcriptIds: z.array(z.string().min(1)).optional(),
});
