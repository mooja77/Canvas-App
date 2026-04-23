import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, isUserPayload } from '../utils/jwt.js';
import { join, leave, leaveAll, getPresence, updateCursor } from './presence.js';
import { prisma } from './prisma.js';

// Check that the user owns the canvas or is an explicit collaborator.
// Share codes grant clone access, not live-coding access, so they don't count here.
async function canAccessCanvas(canvasId: string, userId: string): Promise<boolean> {
  const canvas = await prisma.codingCanvas.findUnique({
    where: { id: canvasId },
    select: { userId: true },
  });
  if (!canvas) return false;
  if (canvas.userId === userId) return true;
  const collab = await prisma.canvasCollaborator.findUnique({
    where: { canvasId_userId: { canvasId, userId } },
    select: { id: true },
  });
  return !!collab;
}

let io: Server | null = null;

export function getIO(): Server | null {
  return io;
}

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === 'production'
          ? process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
            : false
          : ['http://localhost:5174', 'http://localhost:3007'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = verifyToken(token);
    if (!payload || !isUserPayload(payload)) {
      return next(new Error('Invalid token'));
    }

    // Look up user name
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true },
    });
    if (!user) {
      return next(new Error('User not found'));
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

      const allowed = await canAccessCanvas(canvasId, userId);
      if (!allowed) {
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
      });
    });

    // Reject any broadcast for a canvas this socket has not proven access to.
    const requireAuthorized = (canvasId: string | undefined): canvasId is string => {
      return !!canvasId && authorizedCanvases.has(canvasId);
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
    socket.on('node:move', (data: { canvasId: string; nodeId: string; x: number; y: number }) => {
      const { canvasId, nodeId, x, y } = data;
      if (!requireAuthorized(canvasId) || !nodeId) return;

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
    socket.on('canvas:change', (data: { canvasId: string; changeType: string; payload?: unknown }) => {
      const { canvasId, changeType, payload } = data;
      if (!requireAuthorized(canvasId) || !changeType) return;

      socket.to(`canvas:${canvasId}`).emit('canvas:changed', {
        userId,
        userName,
        changeType,
        payload,
      });
    });

    // ─── Document sync events ───

    socket.on('canvas:node-added', (data: { canvasId: string; data: unknown }) => {
      const { canvasId } = data;
      if (!requireAuthorized(canvasId)) return;
      socket.to(`canvas:${canvasId}`).emit('canvas:node-added', {
        userId,
        userName,
        data: data.data,
      });
    });

    socket.on('canvas:node-deleted', (data: { canvasId: string; data: { nodeId: string; nodeType: string } }) => {
      const { canvasId } = data;
      if (!requireAuthorized(canvasId)) return;
      socket.to(`canvas:${canvasId}`).emit('canvas:node-deleted', {
        userId,
        userName,
        data: data.data,
      });
    });

    socket.on(
      'canvas:node-moved',
      (data: { canvasId: string; data: { nodeId: string; position: { x: number; y: number } } }) => {
        const { canvasId } = data;
        if (!requireAuthorized(canvasId)) return;
        socket.to(`canvas:${canvasId}`).emit('canvas:node-moved', {
          userId,
          userName,
          data: data.data,
        });
      },
    );

    socket.on('canvas:coding-added', (data: { canvasId: string; data: unknown }) => {
      const { canvasId } = data;
      if (!requireAuthorized(canvasId)) return;
      socket.to(`canvas:${canvasId}`).emit('canvas:coding-added', {
        userId,
        userName,
        data: data.data,
      });
    });

    socket.on('canvas:coding-deleted', (data: { canvasId: string; data: { codingId: string } }) => {
      const { canvasId } = data;
      if (!requireAuthorized(canvasId)) return;
      socket.to(`canvas:${canvasId}`).emit('canvas:coding-deleted', {
        userId,
        userName,
        data: data.data,
      });
    });

    socket.on('canvas:transcript-updated', (data: { canvasId: string; data: { transcriptId: string } }) => {
      const { canvasId } = data;
      if (!requireAuthorized(canvasId)) return;
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
