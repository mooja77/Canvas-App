import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { CollisionPopover } from './CollisionPopover';

/**
 * This surface used to declare `role="menu"`, which puts a screen reader into
 * application mode and entitles the user to Arrow keys, Home/End and typeahead.
 * None of that was implemented — only Escape and outside-click — and one
 * consumer nested non-`menuitem` children under it, which is invalid ARIA.
 * It also carried an `aria-modal` branch that no caller ever triggered.
 *
 * The markup now claims only what the component does: a container of ordinary
 * buttons that Tab reaches, Escape closes and an outside click dismisses.
 * These tests hold it to exactly that.
 */

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={anchorRef}>anchor</button>
      <button>outside control</button>
      <CollisionPopover open onClose={onClose} anchorRef={anchorRef}>
        <button>first item</button>
        <button>second item</button>
      </CollisionPopover>
    </div>
  );
}

describe('CollisionPopover ARIA and keyboard model', () => {
  it('claims no menu or dialog role it does not implement', () => {
    render(<Harness />);

    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[aria-modal]')).toBeNull();
  });

  it('exposes a stable test handle, since it no longer has a role to select by', () => {
    // e2e specs used getByRole('menu') as a HANDLE - to measure viewport clipping
    // and to click items - not to assert semantics. Removing the false role broke
    // 25 e2e tests. This id is what they select on now, so it is part of the
    // component's contract and must not be renamed casually.
    render(<Harness />);
    expect(screen.getByTestId('collision-popover')).toBeInTheDocument();
  });

  it('exposes its items as ordinary buttons', () => {
    render(<Harness />);

    expect(screen.getByText('first item').tagName).toBe('BUTTON');
    expect(screen.getByText('second item').tagName).toBe('BUTTON');
  });

  it('lets Tab reach every item — the keyboard model it now advertises', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByText('first item').focus();
    expect(document.activeElement).toBe(screen.getByText('first item'));

    await user.tab();
    expect(document.activeElement).toBe(screen.getByText('second item'));
  });

  it('does NOT trap focus — Tab must be able to leave a popover', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByText('second item').focus();
    await user.tab();

    // Whatever it lands on, it must not have been forced back to the first item.
    expect(document.activeElement).not.toBe(screen.getByText('first item'));
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
