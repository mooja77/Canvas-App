import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Screen1_Personalization from './Screen1_Personalization';

vi.mock('../../utils/analytics', () => ({ trackEvent: vi.fn() }));

const NL = String.fromCharCode(10);

function file(name: string, body: string, type = 'text/plain') {
  return new File([body], name, { type });
}

function renderScreen(onPasteTranscript = vi.fn()) {
  render(<Screen1_Personalization onContinue={vi.fn()} onSkip={vi.fn()} onPasteTranscript={onPasteTranscript} />);
  return onPasteTranscript;
}

describe('first screen: start from a transcript file', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says which files it takes, next to the paste box', () => {
    renderScreen();
    const input = screen.getByLabelText(/choose a transcript file/i) as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toBe('.docx,.pdf,.txt,.vtt,.srt');
    expect(screen.getByText(/Word, PDF, text or caption file/i)).toBeInTheDocument();
  });

  it('opens a chosen text file for coding, titled with the file name', async () => {
    const onPaste = renderScreen();
    const body = ['Interviewer: How did it go?', 'P1: Better than I expected.'].join(NL);
    fireEvent.change(screen.getByLabelText(/choose a transcript file/i), {
      target: { files: [file('Interview 01 - Mary.txt', body)] },
    });
    await waitFor(() => expect(onPaste).toHaveBeenCalledTimes(1));
    expect(onPaste).toHaveBeenCalledWith(body, 'Interview 01 - Mary');
  });

  it('turns a Zoom or Teams caption file into clean text', async () => {
    const onPaste = renderScreen();
    const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:04.000', 'P1: I felt supported.', ''].join(NL);
    fireEvent.change(screen.getByLabelText(/choose a transcript file/i), {
      target: { files: [file('focus-group.vtt', vtt, 'text/vtt')] },
    });
    await waitFor(() => expect(onPaste).toHaveBeenCalledTimes(1));
    const [text, title] = onPaste.mock.calls[0];
    expect(text).toContain('I felt supported.');
    expect(text).not.toContain('-->');
    expect(title).toBe('focus-group');
  });

  it('accepts a file dropped on the box', async () => {
    const onPaste = renderScreen();
    const zone = screen.getByTestId('onboarding-transcript-start');
    fireEvent.drop(zone, { dataTransfer: { files: [file('notes.txt', 'Field note one.')] } });
    await waitFor(() => expect(onPaste).toHaveBeenCalledWith('Field note one.', 'notes'));
  });

  it('names the formats when the file is not one it can read, and keeps the paste box', async () => {
    const onPaste = renderScreen();
    fireEvent.change(screen.getByLabelText(/choose a transcript file/i), {
      target: { files: [file('photo.png', 'x', 'image/png')] },
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/photo\.png/);
    expect(alert).toHaveTextContent(/\.docx, \.pdf, \.txt, \.vtt or \.srt/);
    expect(onPaste).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/paste it and start coding/i)).toBeInTheDocument();
  });

  it('says so when the file has no text in it', async () => {
    const onPaste = renderScreen();
    fireEvent.change(screen.getByLabelText(/choose a transcript file/i), {
      target: { files: [file('empty.txt', '   ')] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/no text/i);
    expect(onPaste).not.toHaveBeenCalled();
  });

  it('does not offer a file start when the fast path is off', () => {
    render(<Screen1_Personalization onContinue={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.queryByLabelText(/choose a transcript file/i)).not.toBeInTheDocument();
  });
});
