import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrainingPage } from './TrainingPage';

const analytics = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: analytics.trackEvent }));

describe('TrainingPage', () => {
  beforeEach(() => {
    analytics.trackEvent.mockClear();
  });

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
    expect(screen.getByRole('link', { name: /start your first project/i })).toHaveAttribute('href', '/canvas');
    expect(analytics.trackEvent).toHaveBeenCalledWith('training_page_viewed', { page: '/training' });
  });

  it('measures playlist and activation calls without research data', () => {
    render(
      <MemoryRouter>
        <TrainingPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole('link', { name: /open playlist on youtube/i })[0]);
    expect(analytics.trackEvent).toHaveBeenCalledWith('training_playlist_clicked', {
      playlist: 'Start with QualCanvas',
      surface: 'training_playlists',
    });

    fireEvent.click(screen.getByRole('link', { name: /start your first project/i }));
    expect(analytics.trackEvent).toHaveBeenCalledWith('training_cta_clicked', {
      action: 'start_first_project',
      surface: 'training_bottom_cta',
    });
  });
});
