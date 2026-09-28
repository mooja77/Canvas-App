import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { encryptApiKey } from '../utils/encryption.js';
import { validate, updateAiSettingsSchema } from '../middleware/validation.js';
import { sensitiveValidationLimiter } from '../middleware/rateLimiters.js';
import { checkProviderKey, type AiProviderId } from '../lib/aiKeyCheck.js';
import { collaboratorUsageOnKey, transcriptionUsageOnKey, WHISPER_USD_PER_MINUTE } from '../utils/aiKeys.js';

// The customer's own AI account. QualCanvas never holds a paid AI key: every
// AI feature, transcription included, runs on the key saved here, encrypted
// with AES-256-GCM (utils/encryption.ts) and used only for this account (and,
// if the owner switches it on, for collaborators transcribing into the
// owner's canvases — utils/aiKeys.ts).
export const aiSettingsRoutes = Router();

// ─── GET /ai-settings — Get user's AI config (never returns the actual key) ───
aiSettingsRoutes.get('/ai-settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      // Legacy access-code auth has no userId — return graceful "not configured"
      return res.json({ success: true, data: { hasApiKey: false, emailAccount: false } });
    }

    const config = await prisma.userAiConfig.findUnique({
      where: { userId: req.userId },
      select: { provider: true, model: true, embeddingModel: true, shareWithCollaborators: true, updatedAt: true },
    });

    if (!config) {
      return res.json({ success: true, data: { hasApiKey: false, emailAccount: true } });
    }

    const [transcriptionUsage, collaboratorUsage] =
      config.provider === 'openai'
        ? await Promise.all([transcriptionUsageOnKey(req.userId), collaboratorUsageOnKey(req.userId)])
        : [null, []];

    res.json({
      success: true,
      data: {
        provider: config.provider,
        model: config.model,
        embeddingModel: config.embeddingModel,
        hasApiKey: true,
        emailAccount: true,
        connectedAt: config.updatedAt,
        shareWithCollaborators: config.shareWithCollaborators,
        transcriptionUsage,
        collaboratorUsage,
        whisperUsdPerMinute: WHISPER_USD_PER_MINUTE,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /ai-settings — Validate, encrypt and save the user's own key ───
// Tight limit because this endpoint performs an outbound provider call
// with user-supplied credentials — vulnerable to brute-force otherwise.
aiSettingsRoutes.put(
  '/ai-settings',
  sensitiveValidationLimiter,
  validate(updateAiSettingsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { provider, model, embeddingModel } = req.body as {
        provider: AiProviderId;
        model?: string;
        embeddingModel?: string;
      };
      const apiKey = String(req.body.apiKey).trim();

      // Free, read-only check (lists the provider's models): proves the key is
      // real before anything is stored. Nothing is saved on failure.
      const check = await checkProviderKey(provider, apiKey);
      if (!check.ok) {
        return res.status(400).json({ success: false, error: check.message, code: `AI_KEY_${check.code}` });
      }

      const { encrypted, iv, tag } = encryptApiKey(apiKey);
      const data = {
        provider,
        apiKeyEncrypted: encrypted,
        apiKeyIv: iv,
        apiKeyTag: tag,
        model: model || null,
        embeddingModel: embeddingModel || null,
      };
      const saved = await prisma.userAiConfig.upsert({
        where: { userId: req.userId },
        create: { userId: req.userId, ...data },
        update: data,
        select: { shareWithCollaborators: true },
      });

      res.json({
        success: true,
        data: {
          provider,
          model,
          embeddingModel,
          hasApiKey: true,
          shareWithCollaborators: saved.shareWithCollaborators,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

const sharingSchema = z.object({ shareWithCollaborators: z.boolean() });

// ─── PUT /ai-settings/sharing — owner allows / blocks collaborators using their key ───
aiSettingsRoutes.put(
  '/ai-settings/sharing',
  validate(sharingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const updated = await prisma.userAiConfig.updateMany({
        where: { userId: req.userId },
        data: { shareWithCollaborators: req.body.shareWithCollaborators },
      });
      if (updated.count === 0) {
        return res.status(409).json({
          success: false,
          error: 'Connect your AI account first, then choose whether collaborators can use it.',
          code: 'AI_KEY_REQUIRED',
        });
      }
      res.json({ success: true, data: { shareWithCollaborators: req.body.shareWithCollaborators } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /ai-settings — Remove user's AI config ───
aiSettingsRoutes.delete('/ai-settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    await prisma.userAiConfig.deleteMany({
      where: { userId: req.userId },
    });

    res.json({ success: true, data: { hasApiKey: false } });
  } catch (err) {
    next(err);
  }
});
