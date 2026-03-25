import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCollaboration } from './useCollaboration';
import { useAuthStore } from '../stores/authStore';

// ─── Socket mock ───
type EventHandler = (...args: unknown[]) => void;

function createMockSocket() {
  const listeners = new Map<string, Set<EventHandler>>();
  const socket = {
    connected: false,
    emit: vi.fn(),
    on: vi.fn((event: string, handler: EventHandler) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: EventHandler) => {
      listeners.get(event)?.delete(handler);
    }),
    disconnect: vi.fn(),
    // Helper: simulate server event
    _trigger(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach(fn => fn(...args));
    },
  };
  return socket;
}

let mockSocket: ReturnType<typeof createMockSocket>;

vi.mock('../lib/socket', () => ({
  getSocket: vi.fn(() => mockSocket),
}));

function setEmailAuth() {
  useAuthStore.getState().setEmailAuth({
    jwt: 'test-jwt',
    email: 'user@test.com',
    userId: 'user-123',
    name: 'Test User',
    role: 'user',
    plan: 'pro',
  });
}

function resetAuth() {
  useAuthStore.setState({
    jwt: null,
    name: null,
    role: null,
    authenticated: false,
    authType: null,
    dashboardCode: null,
    dashboardAccessId: null,
    email: null,
    userId: null,
    plan: null,
  });
}

describe('useCollaboration', () => {
  beforeEach(() => {
    mockSocket = createMockSocket();
    resetAuth();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty collaborators when disabled', () => {
    setEmailAuth();
    const { result } = renderHook(() =>
      useCollaboration({ canvasId: 'c1', enabled: false }),
    );
    expect(result.current.collaborators).toEqual([]);
    expect(result.current.isConnected).toBe(false);
  });

  it('returns empty collaborators when no canvasId', () => {
    setEmailAuth();
    const { result } = renderHook(() =>
      useCollaboration({ canvasId: null }),
    );
    expect(result.current.collaborators).toEqual([]);
  });

  it('does not connect for non-email auth (access-code users)', () => {
    useAuthStore.getState().setAuth({
      dashboardCode: 'CODE',
      jwt: 'legacy-jwt',
      name: 'Legacy User',
      role: 'admin',
      dashboardAccessId: 'access-1',
    });

    const { result } = renderHook(() =>
      useCollaboration({ canvasId: 'c1' }),
    );
    expect(result.current.isConnected).toBe(false);
    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  it('emits canvas:join on connection', () => {
    setEmailAuth();
    renderHook(() => useCollaboration({ canvasId: 'c1' }));

    // Simulate socket connect
    act(() => {
      mockSocket._trigger('connect');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('canvas:join', { canvasId: 'c1' });
  });

  it('updates collaborators on presence:updated event', () => {
    setEmailAuth();
    const { result } = renderHook(() =>
      useCollaboration({ canvasId: 'c1' }),
    );

    const users = [
      { userId: 'u2', name: 'Alice', color: '#ff0000' },
    ];

    act(() => {
      mockSocket._trigger('presence:updated', { canvasId: 'c1', users });
    });

    expect(result.current.collaborators).toEqual(users);
  });

  it('updates cursors on cursor:moved event', () => {
    setEmailAuth();
    const { result } = renderHook(() =>
      useCollaboration({ canvasId: 'c1' }),
    );

    act(() => {
      mockSocket._trigger('cursor:moved', {
        userId: 'u2',
        userName: 'Alice',
        x: 100,
        y: 200,
      });
    });

    expect(result.current.cursors.get('u2')).toEqual({
      x: 100,
      y: 200,
      name: 'Alice',
      color: '#3B82F6',
    });
  });

  it('throttles cursor emission (50ms)', () => {
    setEmailAuth();
    renderHook(() => useCollaboration({ canvasId: 'c1' }));

    // Simulate socket connected so socketRef.current is set
    act(() => {
      mockSocket._trigger('connect');
    });

    // Fire two mousemove events in quick succession
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 20 }));
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, clientY: 40 }));
    });

    // Only first should have been emitted (second throttled within 50ms)
    const cursorMoveEmits = mockSocket.emit.mock.calls.filter(
      (c: unknown[]) => c[0] === 'cursor:move'
    );
    expect(cursorMoveEmits).toHaveLength(1);
    expect(cursorMoveEmits[0][1]).toEqual({ canvasId: 'c1', x: 10, y: 20 });
  });

  it('emitNodeMove sends node:move with canvasId, nodeId, x, y', () => {
    setEmailAuth();
    const { result } = renderHook(() =>
      useCollaboration({ canvasId: 'c1' }),
    );

    // Connect the socket so socketRef is populated
    act(() => {
      mockSocket._trigger('connect');
    });

    act(() => {
      result.current.emitNodeMove('n1', 100, 200);
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('node:move', {
      canvasId: 'c1',
      nodeId: 'n1',
      x: 100,
      y: 200,
    });
  });

  it('emitNodeAdded sends canvas:node-added event', () => {
    setEmailAuth();
    const { result } = renderHook(() =>
      useCollaboration({ canvasId: 'c1' }),
    );
    act(() => { mockSocket._trigger('connect'); });

    act(() => {
      result.current.emitNodeAdded('c1', { type: 'transcript', id: 'n1' });
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('canvas:node-added', {
      canvasId: 'c1',
      data: { type: 'transcript', id: 'n1' },
    });
  });

  it('emitNodeDeleted sends canvas:node-deleted event', () => {
    setEmailAuth();
    const { result } = renderHook(() =>
      useCollaboration({ canvasId: 'c1' }),
    );
    act(() => { mockSocket._trigger('connect'); });

    act(() => {
      result.current.emitNodeDeleted('c1', 'n1', 'transcript');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('canvas:node-deleted', {
      canvasId: 'c1',
      data: { nodeId: 'n1', nodeType: 'transcript' },
    });
  });

  it('emitCodingAdded sends canvas:coding-added event', () => {
    setEmailAuth();
    const { result } = renderHook(() =>
      useCollaboration({ canvasId: 'c1' }),
    );
    act(() => { mockSocket._trigger('connect'); });

    act(() => {
      result.current.emitCodingAdded('c1', { id: 'cod1', transcriptId: 't1', questionId: 'q1' });
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('canvas:coding-added', {
      canvasId: 'c1',
      data: { id: 'cod1', transcriptId: 't1', questionId: 'q1' },
    });
  });

  it('emitCodingDeleted sends canvas:coding-deleted event', () => {
    setEmailAuth();
    const { result } = renderHook(() =>
      useCollaboration({ canvasId: 'c1' }),
    );
    act(() => { mockSocket._trigger('connect'); });

    act(() => {
      result.current.emitCodingDeleted('c1', 'cod1');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('canvas:coding-deleted', {
      canvasId: 'c1',
      data: { codingId: 'cod1' },
    });
  });

  it('cleans up listeners on unmount (canvas:leave emitted)', () => {
    setEmailAuth();
    const { unmount } = renderHook(() =>
      useCollaboration({ canvasId: 'c1' }),
    );

    unmount();

    expect(mockSocket.off).toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith('canvas:leave', { canvasId: 'c1' });
  });

  it('skips events from local user (no self-echo)', async () => {
    setEmailAuth();

    const { useCanvasStore } = await import('../stores/canvasStore');
    const refreshSpy = vi.fn();
    useCanvasStore.setState({ refreshCanvas: refreshSpy });

    renderHook(() => useCollaboration({ canvasId: 'c1' }));

    // Trigger a canvas:node-added event from the LOCAL user
    act(() => {
      mockSocket._trigger('canvas:node-added', {
        userId: 'user-123', // same as local userId
        data: { type: 'transcript', id: 'n1' },
      });
    });

    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('does not ignore presence:updated filtering by canvasId', () => {
    setEmailAuth();
    const { result } = renderHook(() =>
      useCollaboration({ canvasId: 'c1' }),
    );

    // Trigger presence for different canvas — should be ignored
    act(() => {
      mockSocket._trigger('presence:updated', {
        canvasId: 'other-canvas',
        users: [{ userId: 'u2', name: 'Bob', color: '#00ff00' }],
      });
    });

    expect(result.current.collaborators).toEqual([]);
  });
});
