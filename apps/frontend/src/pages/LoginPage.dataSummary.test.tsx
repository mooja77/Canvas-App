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

vi.mock('../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: { setAuth: () => void; setEmailAuth: () => void }) => unknown) =>
    selector({ setAuth: vi.fn(), setEmailAuth: vi.fn() }),
}));

import LoginPage from './LoginPage';

describe('LoginPage sign-up data-handling summary (qualcanvas-27)', () => {
  it('summarises where data lives, export, and delete next to the sign-up button', () => {
    render(
      <MemoryRouter initialEntries={['/login?mode=register']}>
        <LoginPage />
      </MemoryRouter>,
    );
    const summary = screen.getByTestId('signup-data-summary');
    expect(summary).toHaveTextContent(/Stored in the US/i);
    expect(summary).toHaveTextContent(/Export your work anytime/i);
    expect(summary).toHaveTextContent(/Delete canvases or your whole account anytime/i);
    expect(screen.getByRole('link', { name: 'Data posture' })).toHaveAttribute('href', '/trust');
  });

  it('does not show the sign-up data summary on the sign-in tab', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('signup-data-summary')).not.toBeInTheDocument();
  });
});
