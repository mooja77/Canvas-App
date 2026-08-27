import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validation.js';

export const publicPilotRoutes = Router();

const pilotTaskIds = ['create-project', 'add-transcript', 'code-passages', 'memo-analysis', 'export'] as const;
const pilotOutcomes = ['easy', 'difficult', 'not-completed', 'not-attempted'] as const;

export const pilotFeedbackSchema = z
  .object({
    participantRole: z.enum([
      'postgraduate-researcher',
      'academic-researcher',
      'ux-service-researcher',
      'educator-supervisor',
      'other',
    ]),
    sector: z.string().trim().max(120).optional().default(''),
    productExperience: z.enum(['first-time', 'some-experience', 'regular-user']),
    taskResults: z
      .array(
        z.object({
          taskId: z.enum(pilotTaskIds),
          outcome: z.enum(pilotOutcomes),
        }),
      )
      .length(pilotTaskIds.length)
      .refine((results) => new Set(results.map((result) => result.taskId)).size === pilotTaskIds.length, {
        message: 'Each pilot task must have one result',
      }),
    hardestStep: z.string().trim().max(2000).optional().default(''),
    missingFeature: z.string().trim().max(2000).optional().default(''),
    adoptionBlocker: z.string().trim().max(2000).optional().default(''),
    recommendationScore: z.number().int().min(0).max(10),
    contactEmail: z
      .union([z.string().trim().email().max(254), z.literal('')])
      .optional()
      .default(''),
    consentToContact: z.boolean().optional().default(false),
    // Honeypot. Real users never see or focus this field. Bots receive the same
    // accepted response without adding noise to the research dataset.
    website: z.string().max(200).optional().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.contactEmail && !data.consentToContact) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['consentToContact'],
        message: 'Consent is required before an email address can be stored',
      });
    }
    if (!data.contactEmail && data.consentToContact) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contactEmail'],
        message: 'Enter an email address if you consent to follow-up',
      });
    }
  });

const pilotFeedbackLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true',
  message: { success: false, error: 'Too many feedback submissions; please try again tomorrow' },
});

publicPilotRoutes.post('/feedback', pilotFeedbackLimiter, validate(pilotFeedbackSchema), async (req, res, next) => {
  try {
    const data = req.body as z.infer<typeof pilotFeedbackSchema>;
    if (data.website) {
      return res.status(202).json({ success: true, message: 'Thank you. Your feedback has been recorded.' });
    }

    await prisma.pilotFeedback.create({
      data: {
        participantRole: data.participantRole,
        sector: data.sector || null,
        productExperience: data.productExperience,
        taskResults: JSON.stringify(data.taskResults),
        hardestStep: data.hardestStep || null,
        missingFeature: data.missingFeature || null,
        adoptionBlocker: data.adoptionBlocker || null,
        recommendationScore: data.recommendationScore,
        contactEmail: data.contactEmail || null,
        consentToContact: Boolean(data.contactEmail && data.consentToContact),
      },
    });

    res.status(201).json({ success: true, message: 'Thank you. Your feedback has been recorded.' });
  } catch (error) {
    next(error);
  }
});
