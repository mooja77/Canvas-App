import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import PageShell from './PageShell';

describe('PageShell and SiteHeader public page accessibility (qualcanvas-21)', () => {
  it('renders a skip link pointing to #main-content and a 44px mobile menu toggle', () => {
    render(
      <MemoryRouter>
        <PageShell>
          <h1>Public page heading</h1>
        </PageShell>
      </MemoryRouter>,
    );

    const skipLink = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skipLink).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');

    const menuButton = screen.getByRole('button', { name: 'Toggle menu' });
    expect(menuButton.className).toContain('min-h-11');
    expect(menuButton.className).toContain('min-w-11');
  });
});
