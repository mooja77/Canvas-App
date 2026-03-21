import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { encryptApiKey } from '../utils/encryption.js';
import { createProvider } from '../lib/llm.js';
import '../lib/llm-openai.js';
import '../lib/llm-anthropic.js';
import '../lib/llm-google.js';
import { validate, updateAiSettingsSchema } from '../middleware/validation.js';

export const aiSettingsRoutes = Router();

// ─── GET /ai-settings — Get user's AI config (never returns the actual key) ───
aiSettingsRoutes.get(
  '/ai-settings',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        // Legacy access-code auth has no userId — return graceful "not configured"
        return res.json({ success: true, data: { hasApiKey: false } });
      }

      const config = await prisma.userAiConfig.findUnique({
        where: { userId: req.userId },
        select: {
          provider: true,
          model: true,
          embeddingModel: true,
        },
      });

      if (!config) {
        return res.json({ success: true, data: { hasApiKey: false } });
      }

      res.json({
        success: true,
        data: {
          provider: config.provider,
          model: config.model,
          embeddingModel: config.embeddingModel,
          hasApiKey: true,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PUT /ai-settings — Create or update user's AI config ───
aiSettingsRoutes.put(
  '/ai-settings',
  validate(updateAiSettingsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { provider, apiKey, model, embeddingModel } = req.body;

      // Validate the key by making a minimal test call
      try {
        const testProvider = createProvider(provider, apiKey, model);
        await testProvider.complete({
          messages: [{ role: 'user', content: 'test' }],
          maxTokens: 5,
        });
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          error: `API key validation failed: ${err.message || 'Could not connect to provider'}`,
        });
      }

      // Encrypt the API key
      const { encrypted, iv, tag } = encryptApiKey(apiKey);

      // Upsert the config
      await prisma.userAiConfig.upsert({
        where: { userId: req.userId },
        create: {
          userId: req.userId,
          provider,
          apiKeyEncrypted: encrypted,
          apiKeyIv: iv,
          apiKeyTag: tag,
          model: model || null,
          embeddingModel: embeddingModel || null,
        },
        update: {
          provider,
          apiKeyEncrypted: encrypted,
          apiKeyIv: iv,
          apiKeyTag: tag,
          model: model || null,
          embeddingModel: embeddingModel || null,
        },
      });

      res.json({ success: true, data: { provider, model, embeddingModel, hasApiKey: true } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /ai-settings — Remove user's AI config ───
aiSettingsRoutes.delete(
  '/ai-settings',
  async (req: Request, res: Response, next: NextFunction) => {
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
  },
);
