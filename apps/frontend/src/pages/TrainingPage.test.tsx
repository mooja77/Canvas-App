import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TrainingPage } from './TrainingPage';

describe('TrainingPage', () => {
  it('presents the first-user path, complete library and video privacy disclosure', () => {
    render(
      <MemoryRouter>
        <TrainingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /learn one research outcome at a time/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /from first look to complete handoff/i })).toBeInTheDocument();
    expect(screen.getAllByText('QualCanvas in two minutes').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /four paths through the video library/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /open playlist on youtube/i })).toHaveLength(4);
    expect(screen.getByRole('heading', { name: /video privacy and research boundaries/i })).toBeInTheDocument();
    expect(screen.getByText(/youtube is contacted only after you choose play/i)).toBeInTheDocument();
  });
});
