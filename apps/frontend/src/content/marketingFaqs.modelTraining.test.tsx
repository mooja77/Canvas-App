import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LANDING_FAQS } from './marketingFaqs';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../hooks/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}));

vi.mock('../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

import TrustAIPage from '../pages/TrustAIPage';

describe('Model-training FAQ and /trust/ai answer (qualcanvas-28)', () => {
  it('answers the model-training question directly in LANDING_FAQS', () => {
    const item = LANDING_FAQS.find((f) => /training a model/i.test(f.question));
    expect(item).toBeDefined();
    expect(item!.answer).toMatch(/^No\. QualCanvas never trains AI models on your transcripts or codes\./);
    expect(item!.answer).toMatch(
      /AI features are off unless you connect your own OpenAI, Anthropic, or Google API key/,
    );
    expect(item!.answer).toMatch(/your text is only sent to that provider when you run an AI tool/);
  });

  it('answers the model-training question directly on /trust/ai', () => {
    render(
      <MemoryRouter>
        <TrustAIPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/QualCanvas never trains AI models on your transcripts or codes\./)).toBeInTheDocument();
    expect(
      screen.getByText(/AI features are off unless you connect your own OpenAI, Anthropic, or Google API key/),
    ).toBeInTheDocument();
  });
});
