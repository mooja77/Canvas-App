import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog';
import userEvent from '@testing-library/user-event';

describe('ConfirmDialog', () => {
  it('consumes Escape before background shortcuts can remove the opener', () => {
    const backgroundEscape = vi.fn();
    const onCancel = vi.fn();
    document.addEventListener('keydown', backgroundEscape);
    try {
      render(<ConfirmDialog title="Delete" message="Delete item?" onConfirm={vi.fn()} onCancel={onCancel} />);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(backgroundEscape).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', backgroundEscape);
    }
  });

  it('is a labelled modal with comfortable confirmation targets', () => {
    render(
      <ConfirmDialog title="Delete note" message="This removes the note." onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('alertdialog', { name: 'Delete note' })).toHaveAttribute('aria-modal', 'true');
    for (const name of ['Cancel', 'Delete']) {
      expect(screen.getByRole('button', { name })).toHaveClass('min-h-11', 'min-w-11');
    }
  });

  it('keeps Tab and Shift+Tab within the dialog, starting on Cancel', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button>Background</button>
        <ConfirmDialog title="Delete" message="Delete item?" onConfirm={vi.fn()} onCancel={vi.fn()} />
      </>,
    );
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
  });

  it('restores focus to the opener when unmounted', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Open confirmation';
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(
      <ConfirmDialog title="Delete" message="Delete item?" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('holds focus on the dialog while every action is disabled', async () => {
    let resolveConfirm: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    const user = userEvent.setup();
    render(
      <>
        <button>Background</button>
        <ConfirmDialog title="Delete" message="Delete item?" onConfirm={onConfirm} onCancel={vi.fn()} />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveFocus();
    await user.tab();
    expect(dialog).toHaveFocus();
    resolveConfirm();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
  });

  it('awaits async confirmation and blocks duplicate submits', async () => {
    let resolveConfirm: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    const onCancel = vi.fn();

    render(<ConfirmDialog title="Delete" message="Delete item?" onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Working...' })).toBeDisabled();

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Working...' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);

    resolveConfirm();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled());
  });
});
