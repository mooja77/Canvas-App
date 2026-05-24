import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Manual-entry mode is a Title/Content text form whose "Add Transcript" button
// was disabled until both were filled, with no hint — the disabled-button
// anti-pattern. Mock the store + bridge api the modal touches.
const { importNarrativesMock } = vi.hoisted(() => ({ importNarrativesMock: vi.fn() }));
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: () => ({ importNarratives: importNarrativesMock }),
}));
vi.mock('../../../services/api', () => ({ createWiseShiftBridge: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

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
});
