import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('../hooks/usePageMeta', () => ({ usePageMeta: vi.fn() }));

import NotFoundPage from './NotFoundPage';

describe('NotFoundPage', () => {
  afterEach(() => {
    document.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove());
  });

  it('marks the 404 page noindex so soft-404s (SPA returns 200) are not indexed', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    const robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    expect(robots).not.toBeNull();
    expect(robots!.content).toMatch(/noindex/);
  });

  it('removes the noindex tag on unmount so other pages stay indexable', () => {
    const { unmount } = render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    unmount();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });
});
