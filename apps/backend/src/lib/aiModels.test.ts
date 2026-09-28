import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_CHAT_MODELS, DEFAULT_EMBEDDING_MODELS, RETIRED_MODELS, resolveModel } from './aiModels.js';
import { aiCallError, checkProviderKey } from './aiKeyCheck.js';
import { createProvider, registerProviderFactory, withModelSafety, type LlmProvider } from './llm.js';
import { AppError } from '../middleware/errorHandler.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');

/** Every production source file that could name a model. Tests hold historical fixtures, so they are skipped. */
function productionSources(): string[] {
  const roots = ['apps/backend/src', 'apps/frontend/src', 'shared', 'workers', 'worker'].map((r) =>
    path.join(repoRoot, r),
  );
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) && !/\.(test|spec)\.[jt]sx?$/.test(entry.name)) out.push(full);
    }
  };
  roots.forEach(walk);
  for (const env of ['.env.example', 'apps/backend/.env.example', 'apps/frontend/.env.example']) {
    const p = path.join(repoRoot, env);
    if (fs.existsSync(p)) out.push(p);
  }
  return out.filter((f) => !f.endsWith(path.join('lib', 'aiModels.ts')));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('no retired AI model is named anywhere in production code', () => {
  it('scans backend, frontend, shared and workers for every id on the retired list', () => {
    const files = productionSources();
    expect(files.length).toBeGreaterThan(50); // the walk really found the code
    const hits: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const id of Object.keys(RETIRED_MODELS)) {
        // Whole-id match: "gpt-4" must not match "gpt-4o", "embedding-001" not "gemini-embedding-001".
        if (new RegExp(`(?<![\\w.-])${escape(id)}(?![\\w.-])`).test(text)) {
          hits.push(`${path.relative(repoRoot, file)}: ${id}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('the defaults are not retired', () => {
    for (const m of [...Object.values(DEFAULT_CHAT_MODELS), ...Object.values(DEFAULT_EMBEDDING_MODELS)]) {
      expect(RETIRED_MODELS[m]).toBeUndefined();
    }
    for (const r of Object.values(RETIRED_MODELS)) {
      expect(RETIRED_MODELS[r.replacement], `${r.replacement} is itself retired`).toBeUndefined();
    }
  });

  it('the Connect-your-AI wizard shows the same defaults the backend uses', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'apps/frontend/src/components/ai/aiProviders.ts'), 'utf8');
    for (const [provider, model] of Object.entries(DEFAULT_CHAT_MODELS)) {
      const block = src.slice(src.indexOf(`id: '${provider}'`));
      expect(/defaultModel: '([^']+)'/.exec(block)?.[1], provider).toBe(model);
    }
  });
});

describe('resolveModel: a saved retired model is mapped when the AI call runs', () => {
  it('maps the retired Sonnet 4 snapshot to its replacement and warns', () => {
    const warn = vi.fn();
    expect(resolveModel('anthropic', 'claude-sonnet-4-20250514', warn)).toBe('claude-sonnet-4-6');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('claude-sonnet-4-20250514'));
  });

  it('maps shut-down Gemini ids, ignoring case and a models/ prefix', () => {
    expect(resolveModel('google', 'models/Gemini-2.0-Flash', vi.fn())).toBe('gemini-3.5-flash');
    expect(resolveModel('google', 'text-embedding-004', vi.fn())).toBe('gemini-embedding-001');
  });

  it('leaves active models alone and returns undefined for "use the default"', () => {
    const warn = vi.fn();
    expect(resolveModel('anthropic', 'claude-sonnet-5', warn)).toBe('claude-sonnet-5');
    expect(resolveModel('openai', 'gpt-4o', warn)).toBe('gpt-4o');
    expect(resolveModel('openai', '', warn)).toBeUndefined();
    expect(resolveModel('openai', null, warn)).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('createProvider hands the factory the replacement, not the retired id', () => {
    const create = vi.fn(
      (_key: string, _model?: string): LlmProvider => ({
        name: 'test-retired',
        complete: vi.fn(),
        completeStreaming: vi.fn(),
        embedText: vi.fn(),
        embedBatch: vi.fn(),
      }),
    );
    registerProviderFactory('test-retired', { create });
    createProvider('test-retired', 'k', 'claude-sonnet-4-20250514');
    expect(create).toHaveBeenCalledWith('k', 'claude-sonnet-4-6');
  });
});

function failing(err: unknown): LlmProvider {
  const reject = () => Promise.reject(err);
  return { name: 'x', complete: reject, completeStreaming: reject, embedText: reject, embedBatch: reject };
}

describe('a provider refusal becomes a clear next step, never a bare 400 or 500', () => {
  it('Anthropic "model not found" -> 422 AI_MODEL_UNAVAILABLE telling the user what to do', async () => {
    const err = Object.assign(
      new Error('404 {"type":"error","error":{"type":"not_found_error","message":"model: x"}}'),
      {
        status: 404,
      },
    );
    const p = withModelSafety('anthropic', failing(err), 'claude-sonnet-5');
    const thrown = await p.complete({ messages: [{ role: 'user', content: 'hi' }] }).catch((e) => e);
    expect(thrown).toBeInstanceOf(AppError);
    expect(thrown.statusCode).toBe(422);
    expect(thrown.extra).toEqual({ code: 'AI_MODEL_UNAVAILABLE' });
    expect(thrown.message).toMatch(/no longer offers the AI model "claude-sonnet-5"/);
    expect(thrown.message).toMatch(/clear the Model box/);
  });

  it('Google SDK status-in-message form is recognised', () => {
    const r = aiCallError('google', 'gemini-2.0-flash', {
      message:
        '[GoogleGenerativeAI Error]: Error fetching from ...: [404 Not Found] models/gemini-2.0-flash is not found',
    });
    expect(r?.code).toBe('AI_MODEL_UNAVAILABLE');
  });

  it('OpenAI 400 "model_not_found" / "does not exist" is a model problem', () => {
    expect(aiCallError('openai', 'gpt-x', { status: 400, code: 'model_not_found', message: 'nope' })?.code).toBe(
      'AI_MODEL_UNAVAILABLE',
    );
    expect(aiCallError('openai', 'gpt-x', { status: 404, message: 'The model `gpt-x` does not exist' })?.code).toBe(
      'AI_MODEL_UNAVAILABLE',
    );
  });

  it('a revoked key during a call is 422, never 401 (401 logs the researcher out of QualCanvas)', () => {
    const r = aiCallError('anthropic', 'claude-sonnet-5', { status: 401, message: 'invalid x-api-key' });
    expect(r).toMatchObject({ statusCode: 422, code: 'AI_KEY_INVALID' });
  });

  it('Anthropic low credit is explained', () => {
    const r = aiCallError('anthropic', 'claude-sonnet-5', {
      status: 400,
      message: 'Your credit balance is too low to access the Anthropic API.',
    });
    expect(r?.code).toBe('AI_NO_CREDIT');
  });

  it('other 4xx gets a readable message; non-provider errors pass through unchanged', async () => {
    expect(aiCallError('openai', 'gpt-4o', { status: 400, message: 'Unsupported parameter' })).toMatchObject({
      statusCode: 422,
      code: 'AI_REQUEST_REJECTED',
    });
    const plain = new Error('ECONNRESET');
    const thrown = await withModelSafety('openai', failing(plain))
      .embedText('x')
      .catch((e) => e);
    expect(thrown).toBe(plain);
  });
});

describe('key validation does not depend on any model', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(['openai', 'anthropic', 'google'] as const)(
    '%s: a GET to the models list, no model named, no body',
    async (p) => {
      const f = vi.fn(async (_url: string, _init: RequestInit) => new Response('{"data":[]}', { status: 200 }));
      vi.stubGlobal('fetch', f);
      expect(await checkProviderKey(p, 'k-123')).toEqual({ ok: true });
      const [url, init] = f.mock.calls[0];
      expect(url).toMatch(/\/models$/);
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      const text = `${url} ${JSON.stringify(init.headers)}`;
      for (const m of [...Object.keys(RETIRED_MODELS), ...Object.values(DEFAULT_CHAT_MODELS)]) {
        expect(text.includes(m), `${p} key check names ${m}`).toBe(false);
      }
    },
  );
});
