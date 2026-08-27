import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { submitFeedback, trackEvent } = vi.hoisted(() => ({
  submitFeedback: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('../services/pilotApi', () => ({ pilotApi: { submitFeedback } }));
vi.mock('../utils/analytics', () => ({ trackEvent }));
// The shared header/footer have their own coverage. Keeping this page test on
// the participant content avoids competing with the DOM-heavy 18-card training
// test when Vitest runs the full frontend suite concurrently.
vi.mock('../components/marketing/PageShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import PilotPage from './PilotPage';

describe('PilotPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitFeedback.mockResolvedValue({ data: { success: true } });
    window.scrollTo = vi.fn();
  });

  it('presents a safe five-task workflow and anonymous feedback form', () => {
    render(
      <MemoryRouter>
        <PilotPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /test one complete research workflow/i })).toBeInTheDocument();
    expect(screen.getByText(/use only fictional, synthetic, or already-public/i)).toBeInTheDocument();
    expect(screen.getAllByRole('combobox', { name: /result$/i })).toHaveLength(5);
    expect(screen.getByText(/feedback may be anonymous/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /privacy policy/i })).toEqual(
      expect.arrayContaining([expect.objectContaining({ pathname: '/privacy' })]),
    );
  });

  it('submits structured task outcomes without requiring contact details', async () => {
    render(
      <MemoryRouter>
        <PilotPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/your role/i), { target: { value: 'postgraduate-researcher' } });
    fireEvent.change(screen.getByLabelText(/previous qualcanvas experience/i), { target: { value: 'first-time' } });
    fireEvent.change(screen.getByLabelText(/1\. create a project result/i), { target: { value: 'easy' } });
    fireEvent.click(screen.getByLabelText('8'));
    fireEvent.click(screen.getByRole('button', { name: /submit pilot feedback/i }));

    await waitFor(() => expect(submitFeedback).toHaveBeenCalledOnce());
    expect(submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        participantRole: 'postgraduate-researcher',
        productExperience: 'first-time',
        recommendationScore: 8,
        contactEmail: '',
        consentToContact: false,
        taskResults: expect.arrayContaining([{ taskId: 'create-project', outcome: 'easy' }]),
      }),
    );
    expect(screen.getByRole('heading', { name: /thank you for testing qualcanvas/i })).toBeInTheDocument();
  });

  it('requires follow-up consent when an email address is entered', () => {
    render(
      <MemoryRouter>
        <PilotPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/^email address$/i), { target: { value: 'participant@example.org' } });
    expect(screen.getByLabelText(/i consent to qualcanvas storing this email/i)).toBeRequired();
  });
});
