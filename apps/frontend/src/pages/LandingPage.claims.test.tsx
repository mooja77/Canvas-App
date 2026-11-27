import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../hooks/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}));

import LandingPage from './LandingPage';

describe('LandingPage factual claims (qualcanvas-7)', () => {
  it('does not promise an unbacked institutional preservation archive', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/preservation archive/i)).not.toBeInTheDocument();
  });

  it('states that audio transcription requires a paid plan and your own OpenAI key', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Free includes one audio file\. Transcribe with your own OpenAI key/i)).toBeInTheDocument();
  });
});
