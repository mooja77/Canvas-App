import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const SOCKET_URL =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).origin : window.location.origin);

/**
 * Get or create the singleton Socket.io client. The `_token` param is kept
 * for call-site compatibility but ignored — auth now rides on the httpOnly
 * jwt cookie via withCredentials.
 */

export function getSocket(_token: string): Socket {
  if (socket?.connected) return socket;

  // Disconnect old socket if it exists but isn't connected
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    // Cookie-only auth: withCredentials sends the httpOnly jwt cookie on the
    // handshake. The server-side socket middleware reads it from headers.
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.warn('[Socket] Connected:', socket?.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected:', reason);
  });

  return socket;
}

/** Disconnect the singleton socket. */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Check if socket is currently connected. */
export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

/** Emit an event on the singleton socket (no-op if not connected). */
export function emitSocketEvent(event: string, data: unknown): void {
  if (socket?.connected) {
    socket.emit(event, data);
  }
}
