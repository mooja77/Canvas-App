import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, isUserPayload } from '../utils/jwt.js';
import { join, leave, leaveAll, getPresence, updateCursor } from './presence.js';
import { prisma } from './prisma.js';
import { corsOrigin } from '../utils/origins.js';

type CanvasSocketRole = 'owner' | 'editor' | 'viewer';

// Check that the user owns the canvas or is an explicit collaborator.
// Share codes grant clone access, not live-coding access, so they don't count here.
async function getCanvasAccess(canvasId: string, userId: string): Promise<CanvasSocketRole | null> {
  const canvas = await prisma.codingCanvas.findUnique({
    where: { id: canvasId },
    select: { userId: true, deletedAt: true },
  });
  if (!canvas || canvas.deletedAt) return null;
  if (canvas.userId === userId) return 'owner';
  const collab = await prisma.canvasCollaborator.findUnique({
    where: { canvasId_userId: { canvasId, userId } },
    select: { role: true },
  });
  return collab?.role === 'editor' || collab?.role === 'viewer' ? collab.role : null;
}

let io: Server | null = null;

export function getIO(): Server | null {
  return io;
}

/** Immediately remove a user's sockets from a canvas after access is revoked. */
export async function revokeCanvasAccess(canvasId: string, userId: string): Promise<void> {
  if (!io) return;
  const room = `canvas:${canvasId}`;
  const sockets = await io.in(room).fetchSockets();
  for (const socket of sockets) {
    if (socket.data.userId !== userId) continue;
    (socket.data.authorizedCanvases as Set<string> | undefined)?.delete(canvasId);
    socket.leave(room);
    socket.emit('canvas:access-revoked', { canvasId });
  }
  leave(canvasId, userId);
  io.to(room).emit('presence:updated', { canvasId, users: getPresence(canvasId) });
}

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT auth middleware.
  //   1. Prefer the httpOnly cookie — shipped automatically by the browser
  //      when the client sets withCredentials on the Socket.IO connection.
  //   2. Fall back to socket.handshake.auth.token for non-browser clients
  //      (integration tests, CLI, future mobile). The frontend no longer
  //      sends a token there.
  io.use(async (socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookieJwt = cookieHeader
      ? cookieHeader
          .split(';')
          .map((c) => c.trim())
          .find((c) => c.startsWith('jwt='))
          ?.slice(4)
      : undefined;
    const token = cookieJwt || (socket.handshake.auth?.token as string | undefined);
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = verifyToken(token);
    if (!payload || !isUserPayload(payload)) {
      return next(new Error('Invalid token'));
    }

    // Look up user + session invalidation timestamp
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, sessionsInvalidAt: true },
    });
    if (!user) {
      return next(new Error('User not found'));
    }

    // Mirror HTTP auth middleware: reject tokens older than the user's last
    // credential rotation so a stolen JWT can't keep the websocket open after
    // a password reset / email change.
    if (user.sessionsInvalidAt && payload.iat) {
      const jwtIssuedMs = payload.iat * 1000;
      if (jwtIssuedMs < user.sessionsInvalidAt.getTime()) {
        return next(new Error('Session invalidated'));
      }
    }

    // Attach user info to socket data
    socket.data.userId = user.id;
    socket.data.userName = user.name;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    const userName = socket.data.userName as string;
    // Track which canvases this socket has proven access to. Every subsequent
    // canvas:* event is gated on membership here so a client can't broadcast
    // to a room it hasn't joined (i.e. hasn't passed the ownership check for).
    const authorizedCanvases = new Set<string>();
    socket.data.authorizedCanvases = authorizedCanvases;

    // ─── canvas:join ───
    socket.on('canvas:join', async (data: { canvasId: string }) => {
      const { canvasId } = data;
      if (!canvasId) return;

      const access = await getCanvasAccess(canvasId, userId);
      if (!access) {
        socket.emit('canvas:join-denied', { canvasId, reason: 'access_denied' });
        return;
      }

      // Leave any other canvas rooms first
      const leftRooms = leaveAll(userId);
      for (const roomId of leftRooms) {
        socket.leave(`canvas:${roomId}`);
        authorizedCanvases.delete(roomId);
        io!.to(`canvas:${roomId}`).emit('presence:updated', {
          canvasId: roomId,
          users: getPresence(roomId),
        });
      }

      // Join the new room
      socket.join(`canvas:${canvasId}`);
      authorizedCanvases.add(canvasId);
      const entry = join(canvasId, userId, userName);

      // Broadcast updated presence to all users in the room
      io!.to(`canvas:${canvasId}`).emit('presence:updated', {
        canvasId,
        users: getPresence(canvasId),
      });

      // Send current presence to the joining user
      socket.emit('presence:current', {
        canvasId,
        users: getPresence(canvasId),
        self: entry,
        role: access,
      });
    });

    // Reject any broadcast for a canvas this socket has not proven access to.
    const requireAuthorized = (canvasId: string | undefined): canvasId is string => {
      return !!canvasId && authorizedCanvases.has(canvasId);
    };

    const revokeSocketCanvas = (canvasId: string) => {
      authorizedCanvases.delete(canvasId);
      socket.leave(`canvas:${canvasId}`);
      leave(canvasId, userId);
      socket.emit('canvas:access-revoked', { canvasId });
      io!.to(`canvas:${canvasId}`).emit('presence:updated', {
        canvasId,
        users: getPresence(canvasId),
      });
    };

    // Re-check the database before every document mutation. Membership can
    // change after a socket joins, and viewers may observe but never publish
    // state-changing events.
    const requireCurrentAccess = async (canvasId: string | undefined, requireEditor: boolean) => {
      if (!requireAuthorized(canvasId)) return false;
      const access = await getCanvasAccess(canvasId, userId);
      if (!access) {
        revokeSocketCanvas(canvasId);
        return false;
      }
      if (requireEditor && access === 'viewer') {
        socket.emit('canvas:permission-denied', { canvasId, reason: 'viewer_read_only' });
        return false;
      }
      return true;
    };

    // ─── canvas:leave ───
    socket.on('canvas:leave', (data: { canvasId: string }) => {
      const { canvasId } = data;
      if (!requireAuthorized(canvasId)) return;

      socket.leave(`canvas:${canvasId}`);
      authorizedCanvases.delete(canvasId);
      leave(canvasId, userId);

      io!.to(`canvas:${canvasId}`).emit('presence:updated', {
        canvasId,
        users: getPresence(canvasId),
      });
    });

    // ─── node:move ───
    socket.on('node:move', async (data: { canvasId: string; nodeId: string; x: number; y: number }) => {
      const { canvasId, nodeId, x, y } = data;
      if (
        !(await requireCurrentAccess(canvasId, true)) ||
        !nodeId ||
        nodeId.length > 200 ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      )
        return;

      // Broadcast to other users in the room
      socket.to(`canvas:${canvasId}`).emit('node:moved', {
        userId,
        userName,
        nodeId,
        x,
        y,
      });
    });

    // ─── cursor:move ───
    socket.on('cursor:move', (data: { canvasId: string; x: number; y: number }) => {
      const { canvasId, x, y } = data;
      if (!requireAuthorized(canvasId)) return;

      updateCursor(canvasId, userId, { x, y });

      // Broadcast to other users in the room
      socket.to(`canvas:${canvasId}`).emit('cursor:moved', {
        userId,
        userName,
        x,
        y,
      });
    });

    // ─── canvas:change (legacy generic event) ───
    socket.on('canvas:change', async (data: { canvasId: string; changeType: string; payload?: unknown }) => {
      const { canvasId, changeType, payload } = data;
      if (!(await requireCurrentAccess(canvasId, true)) || !changeType || changeType.length > 100) return;

      socket.to(`canvas:${canvasId}`).emit('canvas:changed', {
        userId,
        userName,
        changeType,
        payload,
      });
    });

    // ─── Document sync events ───

    socket.on('canvas:node-added', async (data: { canvasId: string; data: unknown }) => {
      const { canvasId } = data;
      if (!(await requireCurrentAccess(canvasId, true))) return;
      socket.to(`canvas:${canvasId}`).emit('canvas:node-added', {
        userId,
        userName,
        data: data.data,
      });
    });

    socket.on('canvas:node-deleted', async (data: { canvasId: string; data: { nodeId: string; nodeType: string } }) => {
      const { canvasId } = data;
      if (!(await requireCurrentAccess(canvasId, true)) || !data.data?.nodeId) return;
      socket.to(`canvas:${canvasId}`).emit('canvas:node-deleted', {
        userId,
        userName,
        data: data.data,
      });
    });

    socket.on(
      'canvas:node-moved',
      async (data: { canvasId: string; data: { nodeId: string; position: { x: number; y: number } } }) => {
        const { canvasId } = data;
        const position = data.data?.position;
        if (
          !(await requireCurrentAccess(canvasId, true)) ||
          !data.data?.nodeId ||
          !position ||
          !Number.isFinite(position.x) ||
          !Number.isFinite(position.y)
        )
          return;
        socket.to(`canvas:${canvasId}`).emit('canvas:node-moved', {
          userId,
          userName,
          data: data.data,
        });
      },
    );

    socket.on('canvas:coding-added', async (data: { canvasId: string; data: unknown }) => {
      const { canvasId } = data;
      if (!(await requireCurrentAccess(canvasId, true))) return;
      socket.to(`canvas:${canvasId}`).emit('canvas:coding-added', {
        userId,
        userName,
        data: data.data,
      });
    });

    socket.on('canvas:coding-deleted', async (data: { canvasId: string; data: { codingId: string } }) => {
      const { canvasId } = data;
      if (!(await requireCurrentAccess(canvasId, true)) || !data.data?.codingId) return;
      socket.to(`canvas:${canvasId}`).emit('canvas:coding-deleted', {
        userId,
        userName,
        data: data.data,
      });
    });

    socket.on('canvas:transcript-updated', async (data: { canvasId: string; data: { transcriptId: string } }) => {
      const { canvasId } = data;
      if (!(await requireCurrentAccess(canvasId, true)) || !data.data?.transcriptId) return;
      socket.to(`canvas:${canvasId}`).emit('canvas:transcript-updated', {
        userId,
        userName,
        data: data.data,
      });
    });

    // ─── disconnect ───
    socket.on('disconnect', () => {
      const leftRooms = leaveAll(userId);
      for (const canvasId of leftRooms) {
        io!.to(`canvas:${canvasId}`).emit('presence:updated', {
          canvasId,
          users: getPresence(canvasId),
        });
      }
    });
  });

  return io;
}
