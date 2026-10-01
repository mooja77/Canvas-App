import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({
  getRepositories: vi.fn(),
  getInsights: vi.fn(),
  createRepository: vi.fn(),
}));

vi.mock('../services/api', () => ({ canvasApi: api }));
vi.mock('../hooks/usePageMeta', () => ({ usePageMeta: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

import RepositoryPage from './RepositoryPage';

describe('RepositoryPage teaching empty states', () => {
  beforeEach(() => vi.clearAllMocks());

  it('explains the value of a repository and offers both a primary action and an example', async () => {
    api.getRepositories.mockResolvedValue({ data: { repositories: [] } });
    render(<RepositoryPage />);

    expect(await screen.findByText('Keep your research findings together')).toBeVisible();
    expect(screen.getByText(/save insights from your projects in one place/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'See a worked example' })).toHaveAttribute('href', '/training#video-17');
    fireEvent.click(screen.getAllByRole('button', { name: 'Create your first repository' })[0]);
    expect(screen.getByPlaceholderText('Repository name')).toBeVisible();
  });

  it('explains an empty insight list and opens the first-insight form', async () => {
    api.getRepositories.mockResolvedValue({
      data: {
        repositories: [
          { id: 'repo-1', userId: 'user-1', name: 'Interview themes', description: null, createdAt: '2026-09-26' },
        ],
      },
    });
    api.getInsights.mockResolvedValue({ data: { insights: [] } });
    render(<RepositoryPage />);

    fireEvent.click(await screen.findByText('Interview themes'));
    expect(await screen.findByText('No insights yet')).toBeVisible();
    expect(screen.getByRole('link', { name: 'See an example insight' })).toHaveAttribute('href', '/training#video-17');
    fireEvent.click(screen.getByRole('button', { name: 'Add your first insight' }));
    await waitFor(() => expect(screen.getByPlaceholderText('Insight title')).toBeVisible());
  });
});
