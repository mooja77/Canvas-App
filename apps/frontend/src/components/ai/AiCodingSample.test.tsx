import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AiCodingSample, { SAMPLE_AI_SUGGESTIONS } from './AiCodingSample';

describe('AiCodingSample (qualcanvas-24 no-key worked example)', () => {
  it('renders built-in demo data with all 3 suggestions and clearly states no key is used', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<AiCodingSample />);

    expect(screen.getByTestId('ai-coding-sample')).toBeInTheDocument();
    expect(screen.getByText(/Worked AI coding sample \(demo data, no key used\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Live AI coding always runs on your own OpenAI, Anthropic, or Google key/i),
    ).toBeInTheDocument();

    for (const item of SAMPLE_AI_SUGGESTIONS) {
      expect(screen.getByText(item.codeLabel)).toBeInTheDocument();
      expect(screen.getByText(item.reasoning)).toBeInTheDocument();
    }
    expect(screen.getByTestId('ai-sample-summary')).toHaveTextContent('0 of 3 accepted');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('lets a researcher accept, reject, and reset suggestions locally without network calls', () => {
    render(<AiCodingSample />);

    fireEvent.click(screen.getByRole('button', { name: 'Accept Identity transition' }));
    expect(screen.getByTestId('ai-sample-summary')).toHaveTextContent('1 of 3 accepted');
    expect(screen.getByTestId('sample-quote-sample-1')).toHaveAttribute('data-state', 'accepted');

    fireEvent.click(screen.getByRole('button', { name: 'Reject Caregiving expertise' }));
    expect(screen.getByTestId('sample-quote-sample-2')).toHaveAttribute('data-state', 'rejected');

    fireEvent.click(screen.getByRole('button', { name: 'Reset sample' }));
    expect(screen.getByTestId('ai-sample-summary')).toHaveTextContent('0 of 3 accepted');
    expect(screen.getByTestId('sample-quote-sample-1')).toHaveAttribute('data-state', 'pending');
  });

  it('calls onConnectKey when the user clicks the connect CTA', () => {
    const onConnectKey = vi.fn();
    render(<AiCodingSample onConnectKey={onConnectKey} />);

    fireEvent.click(screen.getByRole('button', { name: /Connect your AI key/i }));
    expect(onConnectKey).toHaveBeenCalledTimes(1);
  });
});
