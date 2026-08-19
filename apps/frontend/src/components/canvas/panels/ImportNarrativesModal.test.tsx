import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Manual-entry mode is a Title/Content text form whose "Add Transcript" button
// was disabled until both were filled, with no hint — the disabled-button
// anti-pattern. Mock the store + bridge api the modal touches.
const { importNarrativesMock } = vi.hoisted(() => ({ importNarrativesMock: vi.fn() }));
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: () => ({ importNarratives: importNarrativesMock }),
}));
vi.mock('../../../services/api', () => ({
  createWiseShiftBridge: vi.fn(),
  apiErrorMessage: (err: unknown, fallback: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any)?.response?.data?.error || fallback,
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import toast from 'react-hot-toast';
import ImportNarrativesModal from './ImportNarrativesModal';

function renderManualMode() {
  render(<ImportNarrativesModal onClose={vi.fn()} />);
  // Default mode is the WISEShift bridge; switch to Manual Entry.
  fireEvent.click(screen.getByRole('button', { name: /manual entry/i }));
}

describe('ImportNarrativesModal — manual entry required-field UX', () => {
  beforeEach(() => {
    importNarrativesMock.mockReset();
  });

  it('marks manual Title and Content as required (native browser validation)', () => {
    renderManualMode();
    expect(screen.getByLabelText(/^Title/)).toBeRequired();
    expect(screen.getByLabelText(/^Content/)).toBeRequired();
  });

  it('keeps the Add Transcript button enabled when fields are empty', () => {
    renderManualMode();
    expect(screen.getByRole('button', { name: /add transcript/i })).toBeEnabled();
  });

  // The server writes plan-limit refusals for end users ("Import would exceed
  // your plan's transcript limit (5 per canvas)..."). Swallowing it behind a
  // bare "Failed to add transcript" leaves the user with no idea what to change.
  it("surfaces the server's explanation when the import is refused", async () => {
    importNarrativesMock.mockRejectedValue({
      response: {
        data: {
          error: "Import would exceed your plan's transcript limit (5 per canvas). You have 4 and are importing 3.",
        },
      },
    });
    renderManualMode();
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Interview 5' } });
    fireEvent.change(screen.getByLabelText(/^Content/), { target: { value: 'Some transcript text' } });
    fireEvent.click(screen.getByRole('button', { name: /add transcript/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Import would exceed your plan's transcript limit (5 per canvas). You have 4 and are importing 3.",
      );
    });
  });

  it('still falls back to a generic message when the server says nothing useful', async () => {
    importNarrativesMock.mockRejectedValue(new Error('Network Error'));
    renderManualMode();
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Interview 5' } });
    fireEvent.change(screen.getByLabelText(/^Content/), { target: { value: 'Some transcript text' } });
    fireEvent.click(screen.getByRole('button', { name: /add transcript/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to add transcript');
    });
  });
});
