import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, isUserPayload } from '../utils/jwt.js';
import { join, leave, leaveAll, getPresence, updateCursor } from './presence.js';
import { prisma } from './prisma.js';

let io: Server | null = null;

export function getIO(): Server | null {
  return io;
}

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : false)
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

    // ─── canvas:join ───
    socket.on('canvas:join', (data: { canvasId: string }) => {
      const { canvasId } = data;
      if (!canvasId) return;

      // Leave any other canvas rooms first
      const leftRooms = leaveAll(userId);
      for (const roomId of leftRooms) {
        socket.leave(`canvas:${roomId}`);
        io!.to(`canvas:${roomId}`).emit('presence:updated', {
          canvasId: roomId,
          users: getPresence(roomId),
        });
      }

      // Join the new room
      socket.join(`canvas:${canvasId}`);
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

    // ─── canvas:leave ───
    socket.on('canvas:leave', (data: { canvasId: string }) => {
      const { canvasId } = data;
      if (!canvasId) return;

      socket.leave(`canvas:${canvasId}`);
      leave(canvasId, userId);

      io!.to(`canvas:${canvasId}`).emit('presence:updated', {
        canvasId,
        users: getPresence(canvasId),
      });
    });

    // ─── node:move ───
    socket.on('node:move', (data: { canvasId: string; nodeId: string; x: number; y: number }) => {
      const { canvasId, nodeId, x, y } = data;
      if (!canvasId || !nodeId) return;

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
      if (!canvasId) return;

      updateCursor(canvasId, userId, { x, y });

      // Broadcast to other users in the room
      socket.to(`canvas:${canvasId}`).emit('cursor:moved', {
        userId,
        userName,
        x,
        y,
      });
    });

    // ─── canvas:change ───
    socket.on('canvas:change', (data: { canvasId: string; changeType: string; payload?: unknown }) => {
      const { canvasId, changeType, payload } = data;
      if (!canvasId || !changeType) return;

      // Broadcast to other users in the room
      socket.to(`canvas:${canvasId}`).emit('canvas:changed', {
        userId,
        userName,
        changeType,
        payload,
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
