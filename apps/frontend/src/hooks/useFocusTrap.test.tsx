import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { useFocusTrap } from './useFocusTrap';

/**
 * `aria-modal="true"` tells assistive technology the rest of the page is inert.
 * Without a focus trap that is a false promise: Tab walks the background while
 * a screen reader insists a modal is open. An audit found 28 of 31 dialogs in
 * this app with no focus management at all.
 *
 * The hook existed but had no tests, and could not have had useful ones: its
 * visibility filter used `offsetParent`, which is always null under jsdom, so
 * every element read as hidden and the trap degraded to "focus the container".
 * These tests only mean something because that filter now uses computed style.
 */

function Dialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  return (
    <div ref={ref} role="dialog" aria-modal="true">
      <button>first</button>
      <input aria-label="middle" />
      <button onClick={onClose}>last</button>
    </div>
  );
}

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>open dialog</button>
      <button>background control</button>
      {open && <Dialog onClose={() => setOpen(false)} />}
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus into the dialog on open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open dialog'));

    expect(document.activeElement).toBe(screen.getByText('first'));
  });

  it('cycles forward from the last control back to the first', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open dialog'));

    screen.getByText('last').focus();
    await user.tab();

    expect(document.activeElement).toBe(screen.getByText('first'));
  });

  it('cycles backward from the first control to the last', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open dialog'));

    screen.getByText('first').focus();
    await user.tab({ shift: true });

    expect(document.activeElement).toBe(screen.getByText('last'));
  });

  it('never lets Tab reach a control outside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open dialog'));

    const background = screen.getByText('background control');
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(document.activeElement).not.toBe(background);
    }
  });

  it('restores focus to the trigger when the dialog closes', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByText('open dialog');
    await user.click(trigger);

    await user.click(screen.getByText('last')); // closes the dialog
    expect(document.activeElement).toBe(trigger);
  });

  it('skips controls hidden with display:none rather than trapping onto them', async () => {
    function WithHidden() {
      const ref = useRef<HTMLDivElement>(null);
      useFocusTrap(ref);
      return (
        <div ref={ref} role="dialog" aria-modal="true">
          <button style={{ display: 'none' }}>collapsed</button>
          <button>visible</button>
        </div>
      );
    }
    render(<WithHidden />);
    expect(document.activeElement).toBe(screen.getByText('visible'));
  });

  it('focuses the container when the dialog has no focusable controls', () => {
    function Empty() {
      const ref = useRef<HTMLDivElement>(null);
      useFocusTrap(ref);
      return (
        <div ref={ref} role="dialog" aria-modal="true" data-testid="empty">
          <p>Nothing to focus</p>
        </div>
      );
    }
    render(<Empty />);
    expect(document.activeElement).toBe(screen.getByTestId('empty'));
  });
});
