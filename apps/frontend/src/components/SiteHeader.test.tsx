import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SiteHeader from './SiteHeader';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (state: { authenticated: boolean }) => unknown) => selector({ authenticated: false }),
}));

describe('SiteHeader', () => {
  it('keeps the compact menu through tablet widths', () => {
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    );

    const toggle = screen.getByRole('button', { name: 'Toggle menu' });
    expect(toggle).toHaveClass('md:hidden');
    const desktopGuide = screen.getByRole('link', { name: 'Guide' });
    expect(desktopGuide.parentElement).toHaveClass('md:flex');
  });
});
