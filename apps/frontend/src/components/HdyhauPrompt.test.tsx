import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockApi } = vi.hoisted(() => ({
  mockApi: { get: vi.fn(), answer: vi.fn(), skip: vi.fn() },
}));

vi.mock('../services/hdyhauApi', () => ({ hdyhauApi: mockApi }));

import HdyhauPrompt from './HdyhauPrompt';

const QUESTION = 'How did you hear about QualCanvas?';

describe('HdyhauPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.answer.mockResolvedValue({ data: { data: { recorded: true } } });
    mockApi.skip.mockResolvedValue({ data: { data: { recorded: true } } });
  });

  it('shows when the server says to ask, with the canonical options and no Shopify option', async () => {
    mockApi.get.mockResolvedValue({ data: { data: { ask: true } } });
    render(<HdyhauPrompt />);
    expect(await screen.findByText(QUESTION)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A conference, course or research network' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(7); // 6 options + Skip
    expect(screen.queryByText(/Shopify/i)).not.toBeInTheDocument();
  });

  it('renders nothing when the server says not to ask (already answered)', async () => {
    mockApi.get.mockResolvedValue({ data: { data: { ask: false } } });
    const { container } = render(<HdyhauPrompt />);
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the lookup fails', async () => {
    mockApi.get.mockRejectedValue(new Error('offline'));
    const { container } = render(<HdyhauPrompt />);
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('one tap records the canonical key and closes', async () => {
    mockApi.get.mockResolvedValue({ data: { data: { ask: true } } });
    render(<HdyhauPrompt />);
    fireEvent.click(await screen.findByRole('button', { name: 'Google search' }));
    expect(mockApi.answer).toHaveBeenCalledWith('google', undefined);
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
  });

  it('skip is recorded server-side and closes', async () => {
    mockApi.get.mockResolvedValue({ data: { data: { ask: true } } });
    render(<HdyhauPrompt />);
    fireEvent.click(await screen.findByRole('button', { name: 'Skip this question' }));
    expect(mockApi.skip).toHaveBeenCalledTimes(1);
    expect(mockApi.answer).not.toHaveBeenCalled();
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
  });

  it('Other reveals a free-text box and submits it', async () => {
    mockApi.get.mockResolvedValue({ data: { data: { ask: true } } });
    render(<HdyhauPrompt />);
    fireEvent.click(await screen.findByRole('button', { name: 'Other' }));
    expect(mockApi.answer).not.toHaveBeenCalled();
    const input = screen.getByLabelText(/Where did you hear about us/);
    expect(input).toHaveAttribute('maxLength', '500');
    fireEvent.change(input, { target: { value: '  A methods seminar ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(mockApi.answer).toHaveBeenCalledWith('other', 'A methods seminar');
  });
});
