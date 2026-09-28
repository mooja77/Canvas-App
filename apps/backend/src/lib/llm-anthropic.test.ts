import { describe, it, expect, vi } from 'vitest';

const create = vi.fn(async (_args: Record<string, unknown>) => ({
  content: [{ type: 'text', text: '{"ok":true}' }],
  usage: { input_tokens: 3, output_tokens: 4 },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));

const { default: anthropicFactory } = await import('./llm-anthropic.js');

describe('Anthropic provider request shape', () => {
  it('defaults to claude-sonnet-5 and never sends temperature (400 on Claude 4.7+ models)', async () => {
    const provider = anthropicFactory.create('k');
    const result = await provider.complete({
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
      ],
      temperature: 0.3,
      responseFormat: 'json',
    });
    const args = create.mock.calls[0][0];
    expect(args.model).toBe('claude-sonnet-5');
    expect(args).not.toHaveProperty('temperature');
    expect(args).not.toHaveProperty('top_p');
    expect(args).not.toHaveProperty('top_k');
    expect(result.model).toBe('claude-sonnet-5');
  });
});
