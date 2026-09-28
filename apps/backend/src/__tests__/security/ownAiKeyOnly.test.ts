import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Request, Response, NextFunction } from 'express';

// "No server key is ever used": QualCanvas must never run customer AI on a key
// JMS Dev Lab pays for, even if OPENAI_API_KEY is set on the server by mistake.

const { mockPrisma, openAiCtor } = vi.hoisted(() => ({
  mockPrisma: { userAiConfig: { findUnique: vi.fn() } },
  openAiCtor: vi.fn(),
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('openai', () => ({
  default: class FakeOpenAI {
    audio = { transcriptions: { create: vi.fn() } };
    chat = { completions: { create: vi.fn() } };
    embeddings = { create: vi.fn() };
    constructor(opts: { apiKey?: string }) {
      openAiCtor(opts);
    }
  },
}));

import * as llm from '../../lib/llm.js';
import { resolveAiConfig } from '../../middleware/aiConfig.js';
import { transcribeAudio } from '../../utils/transcription.js';

const serverKey = () => `sk-server-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

describe('no server AI key is ever used', () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      HOSTED_AI_ENABLED: process.env.HOSTED_AI_ENABLED,
      AI_PROVIDER: process.env.AI_PROVIDER,
    };
    process.env.OPENAI_API_KEY = serverKey();
    process.env.HOSTED_AI_ENABLED = 'true';
    vi.clearAllMocks();
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('the LLM layer has no default/server provider to fall back to', () => {
    const exported = Object.keys(llm);
    for (const gone of [
      'getDefaultProvider',
      'registerProvider',
      'complete',
      'completeStreaming',
      'embedText',
      'embedBatch',
    ]) {
      expect(exported).not.toContain(gone);
    }
  });

  it('createProvider refuses an empty key instead of letting the SDK read OPENAI_API_KEY', () => {
    expect(() => llm.createProvider('openai', '')).toThrow(/own/);
    expect(openAiCtor).not.toHaveBeenCalled();
  });

  it('resolveAiConfig leaves llmProvider unset for a user with no key, even with a server key set', async () => {
    mockPrisma.userAiConfig.findUnique.mockResolvedValue(null);
    const req = { userId: 'u1' } as Request;
    const next = vi.fn() as unknown as NextFunction;
    await resolveAiConfig()(req, {} as Response, next);
    expect(req.llmProvider).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
    expect(openAiCtor).not.toHaveBeenCalled();
  });

  it('resolveAiConfig leaves llmProvider unset for a legacy session (no userId)', async () => {
    const req = {} as Request;
    await resolveAiConfig()(req, {} as Response, vi.fn() as unknown as NextFunction);
    expect(req.llmProvider).toBeUndefined();
    expect(mockPrisma.userAiConfig.findUnique).not.toHaveBeenCalled();
  });

  it('resolveAiConfig does not fall back when the stored key cannot be decrypted', async () => {
    mockPrisma.userAiConfig.findUnique.mockResolvedValue({
      provider: 'openai',
      apiKeyEncrypted: 'garbage',
      apiKeyIv: 'garbage',
      apiKeyTag: 'garbage',
    });
    const req = { userId: 'u1' } as Request;
    await resolveAiConfig()(req, {} as Response, vi.fn() as unknown as NextFunction);
    expect(req.llmProvider).toBeUndefined();
    expect(openAiCtor).not.toHaveBeenCalled();
  });

  it('transcribeAudio refuses without a customer key and never builds a client', async () => {
    await expect(transcribeAudio('/nonexistent.wav', undefined, '')).rejects.toThrow(/own OpenAI key/);
    expect(openAiCtor).not.toHaveBeenCalled();
  });

  it('warns at start-up that a server key is set but ignored', () => {
    const log = vi.fn();
    expect(llm.warnIfServerAiKeyPresent(log)).toBe(true);
    expect(log.mock.calls[0][0]).toMatch(/OPENAI_API_KEY.*ignored/);
    expect(log.mock.calls[0][0]).not.toContain(process.env.OPENAI_API_KEY);
    delete process.env.OPENAI_API_KEY;
    delete process.env.HOSTED_AI_ENABLED;
    delete process.env.AI_PROVIDER;
    expect(llm.warnIfServerAiKeyPresent(log)).toBe(false);
  });

  it('no server code reads process.env.OPENAI_API_KEY', () => {
    const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name !== '__tests__' && name !== 'node_modules') walk(full);
        } else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) {
          const text = readFileSync(full, 'utf8');
          if (/process\.env\.(OPENAI_API_KEY|HOSTED_AI_ENABLED|AI_PROVIDER)\b/.test(text)) offenders.push(full);
        }
      }
    };
    walk(src);
    expect(offenders).toEqual([]);
  });
});
