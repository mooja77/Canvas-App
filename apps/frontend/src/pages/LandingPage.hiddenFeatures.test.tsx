import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

describe('LandingPage hidden research features (qualcanvas-30)', () => {
  it('shows methods statement, coder training, research repository, and 30-day trash on the home page', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    const section = screen.getByTestId('research-extras');
    expect(within(section).getByText('Methods statement')).toBeInTheDocument();
    expect(within(section).getByText('Coder training')).toBeInTheDocument();
    expect(within(section).getByText('Research repository')).toBeInTheDocument();
    expect(within(section).getByText('30-day trash recovery')).toBeInTheDocument();
  });
});
