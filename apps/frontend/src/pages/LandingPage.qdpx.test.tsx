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

describe('LandingPage QDPX import visibility (qualcanvas-6)', () => {
  it('tells NVivo and ATLAS.ti users they can import existing QDPX projects', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/QDPX projects from NVivo and ATLAS\.ti/i)).toBeInTheDocument();
    expect(screen.getByText(/Import & export QDPX/i)).toBeInTheDocument();
    expect(screen.getByText(/Move existing projects in from NVivo or ATLAS\.ti with QDPX import/i)).toBeInTheDocument();
  });
});
