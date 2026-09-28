/**
 * What the "Connect your AI account" wizard tells people about each provider.
 *
 * Prices are OpenAI's published list prices, copied from
 * https://developers.openai.com/api/docs/pricing on 28 Sep 2026
 * (Whisper $0.006 / minute; gpt-4o $2.50 input / $10.00 output per 1M tokens).
 * Re-read that page before changing them — never estimate a price.
 */
export type AiProviderId = 'openai' | 'anthropic' | 'google';

export const OPENAI_PRICING_URL = 'https://developers.openai.com/api/docs/pricing';
export const OPENAI_PRICES_CHECKED = '28 September 2026';
export const WHISPER_USD_PER_MINUTE = 0.006;
export const GPT4O_INPUT_USD_PER_M = 2.5;
export const GPT4O_OUTPUT_USD_PER_M = 10;

export interface ProviderStep {
  text: string;
  link?: { href: string; label: string };
}

export interface ProviderGuide {
  id: AiProviderId;
  name: string;
  tagline: string;
  features: string[];
  transcription: boolean;
  keyPrefix: string;
  pricingUrl: string;
  limitsUrl: string;
  steps: ProviderStep[];
  defaultModel: string;
}

export const PROVIDERS: ProviderGuide[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'Works with every AI feature, including audio transcription.',
    features: ['Audio transcription', 'Code suggestions', 'Auto-code', 'Summaries', 'Research chat'],
    transcription: true,
    keyPrefix: 'sk-',
    pricingUrl: OPENAI_PRICING_URL,
    limitsUrl: 'https://platform.openai.com/settings/organization/limits',
    defaultModel: 'gpt-4o',
    steps: [
      {
        text: 'Create a free OpenAI developer account, or log in if you have one. This is separate from a ChatGPT subscription.',
        link: { href: 'https://platform.openai.com/signup', label: 'Open OpenAI sign-up' },
      },
      {
        text: 'Add a payment method and buy a small amount of credit (for example $5). The API does not work until the account has credit.',
        link: {
          href: 'https://platform.openai.com/settings/organization/billing/overview',
          label: 'Open OpenAI billing',
        },
      },
      {
        text: 'Set a monthly budget so you can never be charged more than you expect.',
        link: { href: 'https://platform.openai.com/settings/organization/limits', label: 'Open OpenAI limits' },
      },
      {
        text: 'Go to API keys and press "Create new secret key". Name it "QualCanvas" and leave permissions on "All".',
        link: { href: 'https://platform.openai.com/api-keys', label: 'Open OpenAI API keys' },
      },
      { text: 'Copy the key. It starts with "sk-" and OpenAI shows it only once, so paste it into the next step now.' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    tagline: 'Text AI only. Transcription still needs an OpenAI key.',
    features: ['Code suggestions', 'Auto-code', 'Summaries'],
    transcription: false,
    keyPrefix: 'sk-ant-',
    pricingUrl: 'https://claude.com/pricing#api',
    limitsUrl: 'https://platform.claude.com/settings/limits',
    defaultModel: 'claude-sonnet-4-20250514',
    steps: [
      {
        text: 'Create a Claude Console (Anthropic) account, or log in.',
        link: { href: 'https://platform.claude.com/', label: 'Open the Claude Console' },
      },
      {
        text: 'Add a payment method and buy some credit.',
        link: { href: 'https://platform.claude.com/settings/billing', label: 'Open Anthropic billing' },
      },
      {
        text: 'Set a monthly spend limit.',
        link: { href: 'https://platform.claude.com/settings/limits', label: 'Open Anthropic limits' },
      },
      {
        text: 'Go to API keys, press "Create Key" and name it "QualCanvas".',
        link: { href: 'https://platform.claude.com/settings/keys', label: 'Open Anthropic API keys' },
      },
      { text: 'Copy the key. It starts with "sk-ant-" and is shown only once.' },
    ],
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    tagline: 'Text AI only. Transcription still needs an OpenAI key.',
    features: ['Code suggestions', 'Auto-code', 'Summaries', 'Research chat'],
    transcription: false,
    keyPrefix: 'AI',
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    limitsUrl: 'https://console.cloud.google.com/billing',
    defaultModel: 'gemini-2.0-flash',
    steps: [
      {
        text: 'Sign in to Google AI Studio with a Google account.',
        link: { href: 'https://aistudio.google.com/', label: 'Open Google AI Studio' },
      },
      {
        text: 'Press "Create API key" and choose or create a project.',
        link: { href: 'https://aistudio.google.com/apikey', label: 'Open AI Studio API keys' },
      },
      {
        text: 'If you turn on billing for that project in Google Cloud, add a budget alert there so you know what you spend.',
        link: { href: 'https://console.cloud.google.com/billing', label: 'Open Google Cloud billing' },
      },
      { text: 'Copy the key.' },
    ],
  },
];

export function providerGuide(id: string | null | undefined): ProviderGuide {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export function formatUsd(amount: number): string {
  return amount < 1 ? `$${amount.toFixed(amount < 0.1 ? 3 : 2)}` : `$${amount.toFixed(2)}`;
}
