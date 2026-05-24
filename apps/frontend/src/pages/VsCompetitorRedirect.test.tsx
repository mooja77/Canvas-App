import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VsCompetitorRedirect from './VsCompetitorRedirect';

describe('VsCompetitorRedirect', () => {
  it('redirects an unbuilt /vs/:competitor URL to the /vs index instead of 404', () => {
    render(
      <MemoryRouter initialEntries={['/vs/nvivo']}>
        <Routes>
          <Route path="/vs/:competitor" element={<VsCompetitorRedirect />} />
          <Route path="/vs" element={<div>Comparison index</div>} />
          <Route path="*" element={<div>Page Not Found</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Comparison index')).toBeInTheDocument();
    expect(screen.queryByText('Page Not Found')).not.toBeInTheDocument();
  });
});
