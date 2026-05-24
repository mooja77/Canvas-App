import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TranscriptUploadModal from './TranscriptUploadModal';

// The "Add Transcript" submit was disabled until both fields were filled, with
// no hint about what was missing — the disabled-button anti-pattern the auth/
// account forms (#42/#46/#48/#49) already moved away from. Required fields
// should be marked + validated by the browser, and the button stays enabled so
// the native validation tooltip surfaces what's missing. Labels carry a regex-
// prefix matcher to tolerate the visible "*" required marker decoration.
describe('TranscriptUploadModal — required-field UX', () => {
  it('marks Title and Transcript Content as required (native browser validation)', () => {
    render(<TranscriptUploadModal onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/^Title/)).toBeRequired();
    expect(screen.getByLabelText(/^Transcript Content/)).toBeRequired();
  });

  it('keeps the submit button enabled when fields are empty so the browser surfaces what is missing', () => {
    render(<TranscriptUploadModal onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add transcript/i })).toBeEnabled();
  });
});
