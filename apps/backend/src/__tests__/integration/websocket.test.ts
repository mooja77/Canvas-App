import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';

// ─── Mock Prisma before any imports that use it ───
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
    codingCanvas: {
      findUnique: vi.fn(),
    },
    canvasCollaborator: {
      findUnique: vi.fn(),
    },
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-vitest-do-not-use-in-production';

function signTestToken(userId: string, role = 'user', plan = 'pro'): string {
  return jwt.sign({ userId, role, plan }, JWT_SECRET, { expiresIn: '1h' });
}

// Dynamically import initSocketServer after mocks are in place
let initSocketServer: typeof import('../../lib/socket.js').initSocketServer;

beforeAll(async () => {
  const mod = await import('../../lib/socket.js');
  initSocketServer = mod.initSocketServer;
});

describe('WebSocket / Socket.IO server', () => {
  let httpServer: HttpServer;
  let ioServer: Server;
  let port: number;

  function connectClient(token?: string): ClientSocket {
    return ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      auth: token !== undefined ? { token } : {},
      forceNew: true,
      reconnection: false,
    });
  }

  function waitForEvent<T = unknown>(socket: ClientSocket, event: string, timeout = 3000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeout);
      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  beforeEach(async () => {
    // Default: prisma.user.findUnique resolves a valid user
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Alice Test',
    });
    // Default: canvas exists and is owned by user-1. For any other user, the
    // collaborator check returns truthy so access is still granted. Tests that
    // want to assert denial can override one of these.
    mockPrisma.codingCanvas.findUnique.mockImplementation(({ where }) => {
      return Promise.resolve({ userId: 'user-1', id: where.id });
    });
    mockPrisma.canvasCollaborator.findUnique.mockResolvedValue({ id: 'collab-1' });

    httpServer = createServer();
    ioServer = initSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    ioServer.disconnectSockets(true);
    ioServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    vi.restoreAllMocks();
  });

  // ─── Authentication tests ───

  it('connects with a valid JWT', async () => {
    const token = signTestToken('user-1');
    const client = connectClient(token);

    await waitForEvent(client, 'connect');
    expect(client.connected).toBe(true);
    client.disconnect();
  });

  it('rejects connection without JWT', async () => {
    const client = connectClient();

    const err = await waitForEvent<Error>(client, 'connect_error');
    expect(err.message).toContain('Authentication required');
    expect(client.connected).toBe(false);
    client.disconnect();
  });

  it('rejects connection with invalid JWT', async () => {
    const client = connectClient('totally-bogus-token');

    const err = await waitForEvent<Error>(client, 'connect_error');
    expect(err.message).toContain('Invalid token');
    expect(client.connected).toBe(false);
    client.disconnect();
  });

  it('rejects connection when user not found in DB', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const token = signTestToken('user-nonexistent');
    const client = connectClient(token);

    const err = await waitForEvent<Error>(client, 'connect_error');
    expect(err.message).toContain('User not found');
    client.disconnect();
  });

  // ─── canvas:join / canvas:leave ───

  it('canvas:join adds socket to canvas room and sends presence:current', async () => {
    const token = signTestToken('user-1');
    const client = connectClient(token);
    await waitForEvent(client, 'connect');

    const presencePromise = waitForEvent<{ canvasId: string; users: unknown[]; self: unknown }>(
      client,
      'presence:current',
    );
    client.emit('canvas:join', { canvasId: 'canvas-abc' });

    const presence = await presencePromise;
    expect(presence.canvasId).toBe('canvas-abc');
    expect(presence.users).toBeInstanceOf(Array);
    expect(presence.users.length).toBeGreaterThanOrEqual(1);
    expect(presence.self).toBeDefined();
    client.disconnect();
  });

  it('canvas:leave removes socket from canvas room', async () => {
    // Need two clients: user-1 leaves, user-2 observes the presence:updated
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });
    const client1 = connectClient(signTestToken('user-1'));
    await waitForEvent(client1, 'connect');

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Bob' });
    const client2 = connectClient(signTestToken('user-2'));
    await waitForEvent(client2, 'connect');

    // Both join the room
    client1.emit('canvas:join', { canvasId: 'canvas-leave-test' });
    await waitForEvent(client1, 'presence:current');
    client2.emit('canvas:join', { canvasId: 'canvas-leave-test' });
    await waitForEvent(client2, 'presence:current');

    // Client2 observes client1 leaving
    const updatedPromise = waitForEvent<{ canvasId: string; users: unknown[] }>(client2, 'presence:updated');
    client1.emit('canvas:leave', { canvasId: 'canvas-leave-test' });

    const updated = await updatedPromise;
    expect(updated.canvasId).toBe('canvas-leave-test');
    // Only client2 should remain
    expect(updated.users).toHaveLength(1);

    client1.disconnect();
    client2.disconnect();
  });

  // ─── presence:updated on join / disconnect ───

  it('broadcasts presence:updated when a second user joins', async () => {
    // User 1
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });
    const client1 = connectClient(signTestToken('user-1'));
    await waitForEvent(client1, 'connect');

    const joinPromise = waitForEvent(client1, 'presence:current');
    client1.emit('canvas:join', { canvasId: 'canvas-multi' });
    await joinPromise;

    // User 2
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Bob' });
    const client2 = connectClient(signTestToken('user-2'));
    await waitForEvent(client2, 'connect');

    const presenceUpdate = waitForEvent<{ canvasId: string; users: unknown[] }>(client1, 'presence:updated');
    client2.emit('canvas:join', { canvasId: 'canvas-multi' });

    const updated = await presenceUpdate;
    expect(updated.canvasId).toBe('canvas-multi');
    expect(updated.users.length).toBe(2);

    client1.disconnect();
    client2.disconnect();
  });

  it('broadcasts presence:updated when user disconnects', async () => {
    // User 1
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });
    const client1 = connectClient(signTestToken('user-1'));
    await waitForEvent(client1, 'connect');

    const join1 = waitForEvent(client1, 'presence:current');
    client1.emit('canvas:join', { canvasId: 'canvas-disc' });
    await join1;

    // User 2
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Bob' });
    const client2 = connectClient(signTestToken('user-2'));
    await waitForEvent(client2, 'connect');

    // Wait for client2's join to be acknowledged
    const join2 = waitForEvent(client2, 'presence:current');
    client2.emit('canvas:join', { canvasId: 'canvas-disc' });
    await join2;

    // Listen for presence update on client1 after client2 disconnects
    const presenceUpdate = waitForEvent<{ canvasId: string; users: unknown[] }>(client1, 'presence:updated');
    client2.disconnect();

    const updated = await presenceUpdate;
    expect(updated.canvasId).toBe('canvas-disc');
    expect(updated.users.length).toBe(1);

    client1.disconnect();
  });

  // ─── cursor:move ───

  it('cursor:move broadcasts cursor:moved to other sockets in room', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });
    const client1 = connectClient(signTestToken('user-1'));
    await waitForEvent(client1, 'connect');

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Bob' });
    const client2 = connectClient(signTestToken('user-2'));
    await waitForEvent(client2, 'connect');

    // Both join same room
    client1.emit('canvas:join', { canvasId: 'canvas-cursor' });
    await waitForEvent(client1, 'presence:current');
    client2.emit('canvas:join', { canvasId: 'canvas-cursor' });
    await waitForEvent(client2, 'presence:current');

    // Client1 moves cursor — client2 should see it
    const cursorPromise = waitForEvent<{ userId: string; userName: string; x: number; y: number }>(
      client2,
      'cursor:moved',
    );
    client1.emit('cursor:move', { canvasId: 'canvas-cursor', x: 100, y: 200 });

    const cursor = await cursorPromise;
    expect(cursor.userId).toBe('user-1');
    expect(cursor.userName).toBe('Alice');
    expect(cursor.x).toBe(100);
    expect(cursor.y).toBe(200);

    client1.disconnect();
    client2.disconnect();
  });

  it('cursor:move does NOT echo back to sender', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });
    const client1 = connectClient(signTestToken('user-1'));
    await waitForEvent(client1, 'connect');

    client1.emit('canvas:join', { canvasId: 'canvas-echo' });
    await waitForEvent(client1, 'presence:current');

    // Listen for cursor:moved on sender — should NOT arrive
    let receivedEcho = false;
    client1.on('cursor:moved', () => {
      receivedEcho = true;
    });

    client1.emit('cursor:move', { canvasId: 'canvas-echo', x: 10, y: 20 });

    // Wait a short time to confirm no echo
    await new Promise((r) => setTimeout(r, 200));
    expect(receivedEcho).toBe(false);

    client1.disconnect();
  });

  // ─── Document sync events ───

  it('canvas:node-added broadcasts to room', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });
    const client1 = connectClient(signTestToken('user-1'));
    await waitForEvent(client1, 'connect');

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Bob' });
    const client2 = connectClient(signTestToken('user-2'));
    await waitForEvent(client2, 'connect');

    client1.emit('canvas:join', { canvasId: 'canvas-sync' });
    await waitForEvent(client1, 'presence:current');
    client2.emit('canvas:join', { canvasId: 'canvas-sync' });
    await waitForEvent(client2, 'presence:current');

    const eventPromise = waitForEvent<{ userId: string; userName: string; data: unknown }>(
      client2,
      'canvas:node-added',
    );
    client1.emit('canvas:node-added', {
      canvasId: 'canvas-sync',
      data: { type: 'transcript', id: 'node-1' },
    });

    const event = await eventPromise;
    expect(event.userId).toBe('user-1');
    expect(event.data).toEqual({ type: 'transcript', id: 'node-1' });

    client1.disconnect();
    client2.disconnect();
  });

  it('canvas:node-deleted broadcasts to room', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });
    const client1 = connectClient(signTestToken('user-1'));
    await waitForEvent(client1, 'connect');

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Bob' });
    const client2 = connectClient(signTestToken('user-2'));
    await waitForEvent(client2, 'connect');

    client1.emit('canvas:join', { canvasId: 'canvas-del' });
    await waitForEvent(client1, 'presence:current');
    client2.emit('canvas:join', { canvasId: 'canvas-del' });
    await waitForEvent(client2, 'presence:current');

    const eventPromise = waitForEvent<{ userId: string; data: { nodeId: string; nodeType: string } }>(
      client2,
      'canvas:node-deleted',
    );
    client1.emit('canvas:node-deleted', {
      canvasId: 'canvas-del',
      data: { nodeId: 'node-99', nodeType: 'transcript' },
    });

    const event = await eventPromise;
    expect(event.data.nodeId).toBe('node-99');
    expect(event.data.nodeType).toBe('transcript');

    client1.disconnect();
    client2.disconnect();
  });

  it('canvas:node-moved broadcasts to room', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });
    const client1 = connectClient(signTestToken('user-1'));
    await waitForEvent(client1, 'connect');

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Bob' });
    const client2 = connectClient(signTestToken('user-2'));
    await waitForEvent(client2, 'connect');

    client1.emit('canvas:join', { canvasId: 'canvas-move' });
    await waitForEvent(client1, 'presence:current');
    client2.emit('canvas:join', { canvasId: 'canvas-move' });
    await waitForEvent(client2, 'presence:current');

    const eventPromise = waitForEvent<{ userId: string; data: { nodeId: string; position: { x: number; y: number } } }>(
      client2,
      'canvas:node-moved',
    );
    client1.emit('canvas:node-moved', {
      canvasId: 'canvas-move',
      data: { nodeId: 'node-5', position: { x: 300, y: 400 } },
    });

    const event = await eventPromise;
    expect(event.data.nodeId).toBe('node-5');
    expect(event.data.position).toEqual({ x: 300, y: 400 });

    client1.disconnect();
    client2.disconnect();
  });

  it('canvas:coding-added broadcasts to room', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });
    const client1 = connectClient(signTestToken('user-1'));
    await waitForEvent(client1, 'connect');

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Bob' });
    const client2 = connectClient(signTestToken('user-2'));
    await waitForEvent(client2, 'connect');

    client1.emit('canvas:join', { canvasId: 'canvas-code' });
    await waitForEvent(client1, 'presence:current');
    client2.emit('canvas:join', { canvasId: 'canvas-code' });
    await waitForEvent(client2, 'presence:current');

    const codingData = { id: 'coding-1', transcriptId: 't-1', questionId: 'q-1' };
    const eventPromise = waitForEvent<{ userId: string; data: unknown }>(client2, 'canvas:coding-added');
    client1.emit('canvas:coding-added', {
      canvasId: 'canvas-code',
      data: codingData,
    });

    const event = await eventPromise;
    expect(event.userId).toBe('user-1');
    expect(event.data).toEqual(codingData);

    client1.disconnect();
    client2.disconnect();
  });

  it('canvas:coding-deleted broadcasts to room', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });
    const client1 = connectClient(signTestToken('user-1'));
    await waitForEvent(client1, 'connect');

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Bob' });
    const client2 = connectClient(signTestToken('user-2'));
    await waitForEvent(client2, 'connect');

    client1.emit('canvas:join', { canvasId: 'canvas-codedel' });
    await waitForEvent(client1, 'presence:current');
    client2.emit('canvas:join', { canvasId: 'canvas-codedel' });
    await waitForEvent(client2, 'presence:current');

    const eventPromise = waitForEvent<{ userId: string; data: { codingId: string } }>(client2, 'canvas:coding-deleted');
    client1.emit('canvas:coding-deleted', {
      canvasId: 'canvas-codedel',
      data: { codingId: 'coding-99' },
    });

    const event = await eventPromise;
    expect(event.data.codingId).toBe('coding-99');

    client1.disconnect();
    client2.disconnect();
  });
});
