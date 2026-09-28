/**
 * Resolve the authenticated user's own AI provider for this request.
 *
 * QualCanvas never runs customer AI on a key JMS Dev Lab pays for: there is
 * no server-side fallback. If the user has not connected their own key (or it
 * can no longer be decrypted), req.llmProvider stays undefined and the route
 * answers 400 AI_KEY_REQUIRED, which opens the "Connect your AI account"
 * wizard in the app.
 */

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { decryptApiKey } from '../utils/encryption.js';
import { createProvider } from '../lib/llm.js';
// Ensure all provider factories are registered
import '../lib/llm-openai.js';
import '../lib/llm-anthropic.js';
import '../lib/llm-google.js';

export const AI_KEY_REQUIRED_MESSAGE =
  'Connect your AI account to use this. AI features run on your own OpenAI, Anthropic or Google key, and your provider bills you directly.';

export function resolveAiConfig() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (userId) {
        const config = await prisma.userAiConfig.findUnique({ where: { userId } });
        if (config) {
          try {
            const apiKey = decryptApiKey(config.apiKeyEncrypted, config.apiKeyIv, config.apiKeyTag);
            req.llmProvider = createProvider(config.provider, apiKey, config.model || undefined);
          } catch {
            // Undecryptable key: treat as not connected. Never fall back to a server key.
          }
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
