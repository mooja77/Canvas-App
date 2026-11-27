import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VsIndexPage from './VsIndexPage';

describe('VsIndexPage SEO targeting (qualcanvas-8)', () => {
  it('targets NVivo, ATLAS.ti, and Dedoose alternative searches in heading and page title', () => {
    render(
      <MemoryRouter initialEntries={['/vs']}>
        <VsIndexPage />
      </MemoryRouter>,
    );

    expect(document.title).toMatch(/NVivo.*Alternative/i);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /alternative to NVivo, ATLAS\.ti, and Dedoose/i,
    );
    expect(screen.getByRole('heading', { name: /QualCanvas vs\. NVivo/i })).toBeInTheDocument();
  });
});
