import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TranscriptSourceMenu from './TranscriptSourceMenu';

// The transcript-source modals are rendered from inside the canvas toolbar row,
// which carries `backdrop-filter: blur()`. Per spec, backdrop-filter establishes
// a containing block for `position: fixed` descendants — so a non-portaled modal
// resolves `fixed inset-0` against the ~90px toolbar strip instead of the
// viewport, centering itself near the top of the screen and pushing its header
// off-screen (reproduced on prod: Add Transcript modal top at -123px @ 620px
// tall). The modals must portal to document.body so `fixed inset-0` covers the
// real viewport.
describe('TranscriptSourceMenu — modals escape the toolbar containing block', () => {
  it('renders the Paste Text modal in a portal outside the menu subtree', async () => {
    const { container } = render(<TranscriptSourceMenu />);
    fireEvent.click(screen.getByTitle('Add transcript'));
    fireEvent.click(screen.getByText('Paste Text'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Portaled to document.body => NOT inside the component's own subtree.
    expect(container.contains(dialog)).toBe(false);
  });
});
