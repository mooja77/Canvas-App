import { webcrypto } from 'node:crypto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { useAuthStore } from '../stores/authStore';
import { shellForRoute, shellMismatchTarget } from '../utils/appShell';

const privateHeading = 'Synthetic research content';

vi.mock('../pages/CanvasPage', () => ({ default: () => <h1>{privateHeading}</h1> }));
vi.mock('../pages/RepositoryPage', () => ({ default: () => <h1>Synthetic repository</h1> }));
vi.mock('../pages/TeamPage', () => ({ default: () => <h1>Synthetic team</h1> }));
vi.mock('../pages/AdminPage', () => ({ default: () => <h1>Synthetic admin</h1> }));
vi.mock('../pages/ForgotPasswordPage', () => ({ default: () => <h1>Synthetic password request</h1> }));
vi.mock('../pages/ResetPasswordPage', () => ({ default: () => <h1>Synthetic password reset</h1> }));
vi.mock('../pages/VerifyEmailPage', () => ({ default: () => <h1>Synthetic verification</h1> }));
vi.mock('../pages/AccountPage', () => ({ default: () => <h1>Synthetic account</h1> }));

async function workerDestination(path: string) {
  // @ts-expect-error The production Pages worker has no TypeScript declarations.
  const worker = (await import('../../public/_worker.js')) as unknown as {
    default: { fetch(request: Request, env: unknown): Promise<Response> };
  };
  return worker.default.fetch(new Request(`https://qualcanvas.invalid${path}`), {
    ASSETS: {
      async fetch(request: Request) {
        const path = new URL(request.url).pathname;
        if (path === '/app-shell' || path === '/support-shell') return new Response(path, { status: 200 });
        return new Response(null, { status: 404 });
      },
    },
  });
}

function observeDocumentNavigation() {
  // Keep routing/history and location reads on the real jsdom document, and
  // replace only the browser operations jsdom cannot actually perform.
  const realWindow = window;
  const reload = vi.fn();
  const replace = vi.fn();
  const location = new Proxy({} as Location, {
    get(_target, property) {
      if (property === 'reload') return reload;
      if (property === 'replace') return replace;
      return Reflect.get(realWindow.location, property);
    },
  });
  vi.stubGlobal(
    'window',
    new Proxy({} as Window, {
      get(_target, property) {
        if (property === 'location') return location;
        const value = Reflect.get(realWindow, property);
        return typeof value === 'function' ? value.bind(realWindow) : value;
      },
    }),
  );
  return { reload, replace };
}

describe('document shell boundary', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    useAuthStore.setState({ authenticated: true });
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useAuthStore.setState({ authenticated: false });
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
    delete document.documentElement.dataset.shell;
  });

  it('renders the research route in its matching document', async () => {
    document.documentElement.dataset.shell = 'app';
    window.history.replaceState(null, '', '/canvas');
    render(<App />);
    expect(await screen.findByRole('heading', { name: privateHeading })).toBeInTheDocument();
  });

  it('withholds research content when a real support link changes paths and reload is suppressed', async () => {
    document.documentElement.dataset.shell = 'support';
    window.history.replaceState(null, '', '/support');
    render(<App />);
    const link = await screen.findByRole('link', { name: 'Back to canvas' });
    expect(await shellMismatchTarget('/canvas', '', '')).toBe('/canvas');
    const { reload } = observeDocumentNavigation();

    fireEvent.click(link);

    await waitFor(() => expect(window.location.pathname).toBe('/canvas'));
    const recovery = await screen.findByRole('button', { name: 'Reload this page' });
    expect(screen.queryByRole('heading', { name: privateHeading })).not.toBeInTheDocument();
    fireEvent.click(recovery);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('fully reloads a normal canvas bookmark with a fragment in a stale support document', async () => {
    document.documentElement.dataset.shell = 'support';
    window.history.replaceState(null, '', '/canvas#notes');
    const { reload, replace } = observeDocumentNavigation();
    render(<App />);

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#notes');
    expect(screen.queryByRole('heading', { name: privateHeading })).not.toBeInTheDocument();
  });

  it.each([
    ['/canvas', 'app', privateHeading],
    ['/canvas/Synthetic-ID/', 'app', privateHeading],
    ['/canvas/Synthetic%20ID', 'app', privateHeading],
    ['/repository', 'app', 'Synthetic repository'],
    ['/team/', 'app', 'Synthetic team'],
    ['/admin', 'app', 'Synthetic admin'],
    ['/forgot-password', 'app', 'Synthetic password request'],
    ['/reset-password/', 'app', 'Synthetic password reset'],
    ['/verify-email', 'app', 'Synthetic verification'],
    ['/account/', 'support', 'Synthetic account'],
    ['/support', 'support', 'Help'],
  ])('uses the Worker and classifier shell for canonical %s', async (path, shell, heading) => {
    const response = await workerDestination(path);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(`/${shell}-shell`);
    expect(shellForRoute(path)).toBe(shell);
    document.documentElement.dataset.shell = shell;
    window.history.replaceState(null, '', path);
    render(<App />);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it.each([
    '/Canvas',
    '/CANVAS/Synthetic-ID',
    '/Repository',
    '/TEAM/',
    '/Admin',
    '/Forgot-Password',
    '/Reset-Password/',
    '/VERIFY-EMAIL',
    '/Account/',
    '/Support',
    '/can%76as',
    '/supp%6Frt',
  ])('keeps %s outside private routing when the Worker rejects it', async (path) => {
    expect((await workerDestination(path)).status).toBe(404);
    expect(shellForRoute(path)).toBe('marketing');
    document.documentElement.dataset.shell = 'marketing';
    window.history.replaceState(null, '', path);
    render(<App />);
    expect(await screen.findByText('404')).toBeInTheDocument();
  });
});
