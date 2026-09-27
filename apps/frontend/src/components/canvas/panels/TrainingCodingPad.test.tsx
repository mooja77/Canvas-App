import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CanvasQuestion } from '@qualcanvas/shared';
import TrainingCodingPad from './TrainingCodingPad';
import { kappaBand, formatMinutes } from './featureScreenUtils';

const questions = [
  { id: 'q1', text: 'Fatigue', color: '#ef4444' },
  { id: 'q2', text: 'Support', color: '#22c55e' },
] as CanvasQuestion[];

function select(textarea: HTMLTextAreaElement, start: number, end: number) {
  textarea.setSelectionRange(start, end);
  fireEvent.keyUp(textarea, { key: 'Shift' });
}

describe('TrainingCodingPad', () => {
  it('adds a coding whose offsets and text are exactly the selected transcript range (whitespace trimmed)', () => {
    const content = 'I love the team. The night shifts are exhausting.';
    const onChange = vi.fn();
    render(<TrainingCodingPad content={content} questions={questions} codings={[]} onChange={onChange} label="T" />);
    const area = screen.getByTestId('training-transcript') as HTMLTextAreaElement;
    const phrase = 'The night shifts are exhausting';
    const start = content.indexOf(phrase);
    select(area, start - 1, start + phrase.length); // includes the leading space
    fireEvent.click(screen.getByRole('button', { name: 'Add coding' }));
    expect(onChange).toHaveBeenCalledWith([
      { questionId: 'q1', startOffset: start, endOffset: start + phrase.length, codedText: phrase },
    ]);
  });

  it('maps positions back through Windows line breaks, which a textarea shows as one character', () => {
    const content = 'Line one\r\nLine two is tired\r\nEnd';
    const onChange = vi.fn();
    render(<TrainingCodingPad content={content} questions={questions} codings={[]} onChange={onChange} label="T" />);
    const area = screen.getByTestId('training-transcript') as HTMLTextAreaElement;
    // In the textarea the text is "Line one\nLine two is tired\nEnd".
    const shown = area.value;
    expect(shown).toBe('Line one\nLine two is tired\nEnd');
    const s = shown.indexOf('tired');
    select(area, s, s + 5);
    fireEvent.change(screen.getByLabelText('Code for the selected passage'), { target: { value: 'q2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add coding' }));
    const [[added]] = onChange.mock.calls[0];
    expect(content.slice(added.startOffset, added.endOffset)).toBe('tired');
    expect(added).toMatchObject({ questionId: 'q2', codedText: 'tired' });
  });

  it('will not add the same coding twice and lets one be removed', () => {
    const content = 'abc def';
    const onChange = vi.fn();
    const existing = [{ questionId: 'q1', startOffset: 0, endOffset: 3, codedText: 'abc' }];
    render(
      <TrainingCodingPad content={content} questions={questions} codings={existing} onChange={onChange} label="T" />,
    );
    select(screen.getByTestId('training-transcript') as HTMLTextAreaElement, 0, 3);
    expect(screen.getByRole('button', { name: 'Add coding' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Remove coding 1/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe('feature screen helpers', () => {
  it('bands kappa the Landis & Koch way', () => {
    expect(kappaBand(0.85)).toBe('almost perfect agreement');
    expect(kappaBand(0.7)).toBe('substantial agreement');
    expect(kappaBand(-0.1)).toBe('less agreement than chance');
  });
  it('formats minutes', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(600)).toBe('10 h');
    expect(formatMinutes(125)).toBe('2 h 5 min');
  });
});
