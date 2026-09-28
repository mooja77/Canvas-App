import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { authState, setConfigured, updateSettings } = vi.hoisted(() => ({
  authState: { authType: 'email' as 'email' | 'legacy' | null },
  setConfigured: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));
vi.mock('../../stores/aiConfigStore', () => ({
  useAiConfigStore: (selector: (s: { setConfigured: typeof setConfigured }) => unknown) => selector({ setConfigured }),
}));
vi.mock('../../services/api', () => ({ aiSettingsApi: { updateSettings } }));

import ConnectAiWizard from './ConnectAiWizard';

const fakeKey = () => `sk-test-${Math.random().toString(36).slice(2)}`;

function renderWizard(props: Partial<React.ComponentProps<typeof ConnectAiWizard>> = {}) {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <ConnectAiWizard onClose={onClose} {...props} />
    </MemoryRouter>,
  );
  return { onClose };
}

const step = () => screen.getByTestId('connect-ai-step');

async function toKeyStep() {
  fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'I have my key' }));
  expect(step()).toHaveTextContent('Test your key');
}

describe('ConnectAiWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.authType = 'email';
  });

  it('is an accessible modal dialog with a progress list', () => {
    renderWizard();
    const dialog = screen.getByRole('dialog', { name: 'Connect your AI account' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('list', { name: 'Progress' })).toBeInTheDocument();
    expect(screen.getByText(/1\. How it works/)).toHaveAttribute('aria-current', 'step');
  });

  it('step 1 explains what the key is for, that the provider bills you, and cites OpenAI pricing', () => {
    renderWizard({ reason: 'Audio transcription' });
    expect(step()).toHaveTextContent('How it works');
    expect(screen.getByText(/You pay the provider directly/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.006 a minute/)).toBeInTheDocument();
    const pricing = screen.getByRole('link', { name: /OpenAI's pricing page/ });
    expect(pricing).toHaveAttribute('href', 'https://developers.openai.com/api/docs/pricing');
    expect(pricing).toHaveAttribute('target', '_blank');
  });

  it('step 3 gives numbered steps with links to the provider, including a spending limit', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const steps = screen.getByTestId('connect-ai-steps');
    expect(steps.tagName).toBe('OL');
    expect(steps.querySelectorAll('li').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole('link', { name: /Open OpenAI API keys/ })).toHaveAttribute(
      'href',
      'https://platform.openai.com/api-keys',
    );
    expect(screen.getByRole('link', { name: /Open OpenAI limits/ })).toBeInTheDocument();
  });

  it('warns that transcription needs OpenAI when another provider is picked for transcription', () => {
    renderWizard({ reason: 'Audio transcription' });
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    fireEvent.click(screen.getByRole('radio', { name: /Anthropic/ }));
    expect(screen.getByRole('note')).toHaveTextContent('Transcription only works with an OpenAI key');
  });

  it('shows a loading state, then the server’s plain-English error, and saves nothing', async () => {
    let reject!: (e: unknown) => void;
    updateSettings.mockReturnValue(new Promise((_r, j) => (reject = j)));
    renderWizard();
    await toKeyStep();
    fireEvent.change(screen.getByLabelText('OpenAI API key'), { target: { value: fakeKey() } });
    fireEvent.click(screen.getByRole('button', { name: 'Test and save key' }));
    expect(await screen.findByTestId('connect-ai-testing')).toHaveTextContent('Testing your key with OpenAI');
    reject({
      response: { status: 400, data: { error: 'OpenAI did not accept this key. Check you copied the whole key.' } },
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("That key didn't work.");
    expect(alert).toHaveTextContent('OpenAI did not accept this key');
    expect(screen.getByLabelText('OpenAI API key')).toHaveAttribute('aria-invalid', 'true');
    expect(setConfigured).not.toHaveBeenCalled();
  });

  it('on success says what is next, explains key security and suggests a spending limit', async () => {
    updateSettings.mockResolvedValue({ data: { data: { hasApiKey: true } } });
    const onConnected = vi.fn();
    const key = fakeKey();
    renderWizard({ reason: 'Audio transcription', onConnected });
    await toKeyStep();
    fireEvent.change(screen.getByLabelText('OpenAI API key'), { target: { value: `  ${key} ` } });
    fireEvent.click(screen.getByRole('button', { name: 'Test and save key' }));
    await waitFor(() => expect(screen.getByTestId('connect-ai-success')).toBeInTheDocument());
    expect(updateSettings).toHaveBeenCalledWith({ provider: 'openai', apiKey: key, model: undefined });
    expect(setConfigured).toHaveBeenCalledWith(true, 'openai');
    expect(onConnected).toHaveBeenCalledWith('openai');
    expect(screen.getByText(/stored encrypted/)).toBeInTheDocument();
    expect(screen.getByText(/Only your account uses it/)).toBeInTheDocument();
    expect(screen.getByText(/remove it at any time/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /set a monthly spending limit/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to transcription' })).toBeInTheDocument();
    // The key is not kept in the form after saving.
    expect(document.body.innerHTML).not.toContain(key);
  });

  it('legacy access-code users get the link-an-email gate instead of the steps', () => {
    authState.authType = 'legacy';
    renderWizard();
    expect(screen.getByRole('link', { name: 'Link your email account' })).toHaveAttribute('href', '/account');
    expect(screen.queryByRole('button', { name: 'Get started' })).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const { onClose } = renderWizard();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
