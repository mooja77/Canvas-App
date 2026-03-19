/**
 * Middleware to resolve the authenticated user's AI config and create
 * a per-request LLM provider from their stored (encrypted) API key.
 *
 * Falls back to server-side OPENAI_API_KEY for legacy users or when
 * no user config is found.
 */

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { decryptApiKey } from '../utils/encryption.js';
import { createProvider, getDefaultProvider } from '../lib/llm.js';
// Ensure all provider factories are registered
import '../lib/llm-openai.js';
import '../lib/llm-anthropic.js';
import '../lib/llm-google.js';

export function resolveAiConfig() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      // If user has a stored AI config, use it
      if (userId) {
        const config = await prisma.userAiConfig.findUnique({
          where: { userId },
        });

        if (config) {
          try {
            const apiKey = decryptApiKey(config.apiKeyEncrypted, config.apiKeyIv, config.apiKeyTag);
            req.llmProvider = createProvider(config.provider, apiKey, config.model || undefined);
            return next();
          } catch {
            // Decryption failed — fall through to server fallback
          }
        }
      }

      // Fallback: use server-side default provider (if configured)
      try {
        req.llmProvider = getDefaultProvider();
      } catch {
        // No server-side key and no user config — llmProvider stays undefined
        // Individual routes will check for this and return appropriate errors
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
