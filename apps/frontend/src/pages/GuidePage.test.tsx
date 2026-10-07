import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GuidePage from './GuidePage';

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
});
function mount() {
  return render(
    <MemoryRouter>
      <GuidePage />
    </MemoryRouter>,
  );
}
describe('current, safe beginner guide', () => {
  it('shows current monthly plans, the institutional option and the real Word report export', () => {
    mount();
    const billing = document.getElementById('billing')!;
    expect(within(billing).getByText(/four self-service plans/)).toBeVisible();
    expect(within(billing).getByText(/Institutions.*custom pricing/)).toBeVisible();
    expect(within(billing).getByRole('img', { name: 'Current monthly pricing plans' })).toHaveAttribute(
      'src',
      '/guide/20-pricing-current-20261007.png',
    );
    expect(within(billing).queryByText(/Annual billing saves ~20%/)).not.toBeInTheDocument();
    expect(within(document.getElementById('export')!).getByText(/Word Report:/)).toBeVisible();
  });
  it('reserves every screenshot size and does not enlarge narrow sidebar pictures to the page width', () => {
    mount();
    for (const image of screen.getAllByRole('img')) {
      expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
      expect(image).toHaveClass('max-w-full');
      expect(image).not.toHaveClass('w-full');
      expect(image.style.width).toBe(`${image.getAttribute('width')}px`);
      expect(image.style.aspectRatio).toBe(`${image.getAttribute('width')} / ${image.getAttribute('height')}`);
    }
  });
  it('teaches first own coding and the detected five-step home guide without promising automatic analysis', () => {
    mount();
    const start = document.getElementById('getting-started')!;
    expect(within(start).getByText(/type a short code name and press Enter/i)).toBeVisible();
    expect(within(start).getByText(/Get started.*five steps/i)).toBeVisible();
    expect(within(start).getByRole('link', { name: /89-second captioned coding lesson/i })).toHaveAttribute(
      'href',
      '/help/first-code.html',
    );
    expect(screen.queryByText(/analysis nodes update live/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Run computation.*again after/i)).toBeVisible();
  });
  it('distinguishes independent copies from access to the original and avoids guaranteed instant synchronization', () => {
    mount();
    const sharing = document.getElementById('collaboration')!;
    expect(within(sharing).getByText(/share codes make independent copies/i)).toBeVisible();
    expect(within(sharing).getByText(/invite a viewer or coder.*original/i)).toBeVisible();
    expect(screen.queryByText(/all changes sync instantly/i)).not.toBeInTheDocument();
  });
  it('offers written setup, import and workflow help with the approved reply time and safe-data boundary', () => {
    mount();
    const support = screen.getByRole('region', { name: /need a hand/i });
    expect(within(support).getByText(/two business days/i)).toBeVisible();
    expect(within(support).getByText(/do not email participant data or transcripts/i)).toBeVisible();
    expect(within(support).getByText(/import.*workflow.*feature/i)).toBeVisible();
    expect(within(support).getByRole('link', { name: /email us for setup help/i })).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:support@qualcanvas\.com\?/),
    );
  });
  it('labels the mobile contents disclosure and lets Escape close it and restore the toggle focus', () => {
    mount();
    const toggle = screen.getByRole('button', { name: 'Guide contents' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'guide-contents');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });
  it('moves keyboard focus to the selected section and offers a real skip target', () => {
    mount();
    expect(screen.getByRole('link', { name: 'Skip to guide' })).toHaveAttribute('href', '#guide-main');
    const contents = screen.getByRole('navigation', { name: 'Guide contents' });
    fireEvent.click(within(contents).getByRole('button', { name: /Analysis Tools/i }));
    expect(screen.getByRole('heading', { name: 'Analysis Tools' })).toHaveFocus();
  });
  it('explains the offline save limitation rather than promising all keyboard access or a native app', () => {
    mount();
    expect(screen.getByText(/offline.*changes.*not saved/i)).toBeVisible();
    expect(screen.queryByText(/full keyboard accessibility/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/native app experience/i)).not.toBeInTheDocument();
  });
});
