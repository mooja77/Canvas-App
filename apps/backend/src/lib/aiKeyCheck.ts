/**
 * Validate a customer's own AI key with a free, read-only call, and turn
 * provider errors into plain-English next steps.
 *
 * The check lists the provider's models. It uses no tokens and costs nothing,
 * but proves the key is real and not revoked. It does not prove the account
 * has credit: OpenAI answers that only when a paid call is made, so the
 * wizard tells people to add credit and set a spending limit, and a later
 * "insufficient_quota" failure is explained by friendlyProviderError.
 */

export type AiProviderId = 'openai' | 'anthropic' | 'google';

export type KeyCheckCode =
  | 'INVALID_KEY'
  | 'NO_PERMISSION'
  | 'NO_CREDIT'
  | 'RATE_LIMITED'
  | 'UNREACHABLE'
  | 'PROVIDER_ERROR';

export type KeyCheckResult = { ok: true } | { ok: false; code: KeyCheckCode; message: string };

const PROVIDER_NAMES: Record<AiProviderId, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google' };

const BILLING_PAGES: Record<AiProviderId, string> = {
  openai: 'https://platform.openai.com/settings/organization/billing/overview',
  anthropic: 'https://platform.claude.com/settings/billing',
  google: 'https://aistudio.google.com/',
};

function request(provider: AiProviderId, apiKey: string): { url: string; headers: Record<string, string> } {
  switch (provider) {
    case 'openai':
      return { url: 'https://api.openai.com/v1/models', headers: { authorization: `Bearer ${apiKey}` } };
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/models',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      };
    case 'google':
      // Header, not ?key=, so the key never lands in a URL or a log line.
      return {
        url: 'https://generativelanguage.googleapis.com/v1beta/models',
        headers: { 'x-goog-api-key': apiKey },
      };
  }
}

export function messageFor(provider: AiProviderId, code: KeyCheckCode): string {
  const name = PROVIDER_NAMES[provider];
  switch (code) {
    case 'INVALID_KEY':
      return `${name} did not accept this key. Check you copied the whole key with no spaces, and that it has not been deleted in your ${name} dashboard. Then paste it again.`;
    case 'NO_PERMISSION':
      return `This ${name} key is restricted and cannot be used here. Create a key with "All" permissions (or allow Models and Audio), then paste it again.`;
    case 'NO_CREDIT':
      return `Your ${name} account has no credit left. Add a payment method or credit at ${BILLING_PAGES[provider]} and try again.`;
    case 'RATE_LIMITED':
      return `${name} is limiting requests from this key right now. Wait a minute and try again.`;
    case 'UNREACHABLE':
      return `We could not reach ${name}. Check your connection and try again in a moment. Nothing was saved.`;
    case 'PROVIDER_ERROR':
      return `${name} returned an error. Try again in a few minutes; if it keeps happening, check ${name}'s status page.`;
  }
}

function codeForStatus(status: number, body: string): KeyCheckCode {
  if (status === 401) return 'INVALID_KEY';
  if (status === 403) return 'NO_PERMISSION';
  if (status === 429) return /insufficient_quota|billing|credit/i.test(body) ? 'NO_CREDIT' : 'RATE_LIMITED';
  if (status === 400 && /api key|API_KEY_INVALID/i.test(body)) return 'INVALID_KEY';
  return 'PROVIDER_ERROR';
}

export async function checkProviderKey(
  provider: AiProviderId,
  apiKey: string,
  opts: { timeoutMs?: number } = {},
): Promise<KeyCheckResult> {
  const { url, headers } = request(provider, apiKey.trim());
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000) });
  } catch {
    return { ok: false, code: 'UNREACHABLE', message: messageFor(provider, 'UNREACHABLE') };
  }
  if (res.ok) return { ok: true };
  const body = await res.text().catch(() => '');
  const code = codeForStatus(res.status, body);
  return { ok: false, code, message: messageFor(provider, code) };
}

/**
 * Plain-English text for an error thrown by a provider SDK during real work
 * (for example a Whisper transcription), so a failed job says what to do.
 */
export function friendlyProviderError(provider: AiProviderId, err: unknown): string {
  const e = err as { status?: number; code?: string; message?: string; error?: { code?: string } };
  const status = typeof e?.status === 'number' ? e.status : 0;
  const detail = `${e?.code ?? ''} ${e?.error?.code ?? ''} ${e?.message ?? ''}`;
  if (status) {
    const code = codeForStatus(status, detail);
    if (code !== 'PROVIDER_ERROR') return messageFor(provider, code);
  }
  return e?.message || 'Transcription failed';
}
