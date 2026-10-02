import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({
  getRepositories: vi.fn(),
  getInsights: vi.fn(),
  createRepository: vi.fn(),
  createInsight: vi.fn(),
  deleteRepository: vi.fn(),
  deleteInsight: vi.fn(),
}));

vi.mock('../services/api', () => ({ canvasApi: api }));
vi.mock('../hooks/usePageMeta', () => ({ usePageMeta: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

import RepositoryPage from './RepositoryPage';

describe('RepositoryPage teaching empty states', () => {
  beforeEach(() => vi.resetAllMocks());

  it('recovers a failed repository read without claiming there are none or creating records', async () => {
    api.getRepositories
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce({ data: { repositories: [] } });
    render(<RepositoryPage />);
    const retry = await screen.findByRole('button', { name: 'Try loading repositories again' });
    expect(screen.queryByText('No repositories yet')).not.toBeInTheDocument();
    expect(retry).toHaveClass('min-h-[44px]');
    fireEvent.click(retry);
    expect(await screen.findByText('No repositories yet')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Research repositories' })).toHaveFocus();
    expect(api.getRepositories).toHaveBeenCalledTimes(2);
    expect(api.createRepository).not.toHaveBeenCalled();
    expect(api.deleteRepository).not.toHaveBeenCalled();
  });

  it('does not treat a malformed successful repository response as an empty list', async () => {
    api.getRepositories.mockResolvedValue({ data: {} });
    render(<RepositoryPage />);
    expect(await screen.findByRole('button', { name: 'Try loading repositories again' })).toBeVisible();
    expect(screen.queryByText('No repositories yet')).not.toBeInTheDocument();
  });

  it('announces pending insights, then offers a read-only retry instead of false empty guidance', async () => {
    let failRead!: (reason: Error) => void;
    api.getRepositories.mockResolvedValue({ data: { repositories: [{ id: 'repo-1', name: 'Interview themes' }] } });
    api.getInsights
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            failRead = reject;
          }),
      )
      .mockResolvedValueOnce({ data: { insights: [] } });
    render(<RepositoryPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open repository Interview themes' }));
    expect(screen.getByRole('status', { name: 'Loading insights' })).toBeVisible();
    expect(screen.queryByText('No insights yet')).not.toBeInTheDocument();
    failRead(new Error('Unavailable'));
    const retry = await screen.findByRole('button', { name: 'Try loading insights again' });
    expect(screen.queryByText('No insights yet')).not.toBeInTheDocument();
    fireEvent.click(retry);
    expect(await screen.findByText('No insights yet')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Repository insights' })).toHaveFocus();
    expect(api.getInsights).toHaveBeenCalledTimes(2);
    expect(api.createInsight).not.toHaveBeenCalled();
    expect(api.deleteInsight).not.toHaveBeenCalled();
  });

  it('explains the value of a repository and offers both a primary action and an example', async () => {
    api.getRepositories.mockResolvedValue({ data: { repositories: [] } });
    render(<RepositoryPage />);

    expect(await screen.findByText('Keep your research findings together')).toBeVisible();
    expect(screen.getByText(/save insights from your projects in one place/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'See a worked example' })).toHaveAttribute('href', '/training#video-17');
    fireEvent.click(screen.getAllByRole('button', { name: 'Create your first repository' })[0]);
    expect(screen.getByPlaceholderText('Repository name')).toBeVisible();
  });

  it('ignores a late insight response after choosing a different repository', async () => {
    let finishFirst!: (value: unknown) => void;
    api.getRepositories.mockResolvedValue({
      data: {
        repositories: [
          { id: 'first', name: 'First project' },
          { id: 'second', name: 'Second project' },
        ],
      },
    });
    api.getInsights
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({
        data: {
          insights: [
            {
              id: 'second-insight',
              title: 'Second finding',
              content: 'Second evidence',
              tags: '[]',
              createdAt: '2026-10-02',
            },
          ],
        },
      });
    render(<RepositoryPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open repository First project' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open repository Second project' }));
    expect(await screen.findByText('Second finding')).toBeVisible();
    finishFirst({
      data: {
        insights: [
          {
            id: 'first-insight',
            title: 'Wrong project finding',
            content: 'Old evidence',
            tags: '[]',
            createdAt: '2026-10-02',
          },
        ],
      },
    });
    await waitFor(() => expect(screen.getByText('Second finding')).toBeVisible());
    expect(screen.queryByText('Wrong project finding')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open repository Second project' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('offers recovery for malformed insights rather than crashing or showing an empty list', async () => {
    api.getRepositories.mockResolvedValue({ data: { repositories: [{ id: 'repo-1', name: 'Interview themes' }] } });
    api.getInsights.mockResolvedValue({ data: { insights: [{ id: 'broken', title: 'Missing content' }] } });
    render(<RepositoryPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open repository Interview themes' }));
    expect(await screen.findByRole('button', { name: 'Try loading insights again' })).toBeVisible();
    expect(screen.queryByText('No insights yet')).not.toBeInTheDocument();
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
