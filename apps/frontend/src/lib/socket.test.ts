import { afterEach, describe, expect, it, vi } from 'vitest';

const { ioMock, socketMock } = vi.hoisted(() => ({
  ioMock: vi.fn(),
  socketMock: {
    connected: false,
    // socket.io-client: true while the handshake is in flight or a reconnect
    // is pending; false once the socket gave up, was rejected, or was closed.
    active: false,
    disconnect: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  },
}));

vi.mock('socket.io-client', () => ({
  io: ioMock.mockReturnValue(socketMock),
}));

import { disconnectSocket, getSocket } from './socket';

describe('realtime socket configuration', () => {
  afterEach(() => {
    disconnectSocket();
    vi.clearAllMocks();
    socketMock.connected = false;
    socketMock.active = false;
  });

  // Bug hunt 2026-09-02: getSocket replaced any socket that was not yet
  // `connected`, so a second caller during the handshake (a canvas switch,
  // Strict Mode's effect replay) or during reconnection back-off tore the
  // pending connection down and opened a fresh one every time.
  it('reuses a socket whose handshake is still in flight instead of replacing it', () => {
    socketMock.active = true;
    const first = getSocket('');
    const second = getSocket('');

    expect(second).toBe(first);
    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(socketMock.disconnect).not.toHaveBeenCalled();
  });

  it('reuses a socket that is waiting to reconnect', () => {
    socketMock.active = true;
    getSocket('');
    socketMock.connected = false; // dropped; manager back-off keeps `active` true
    getSocket('');

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(socketMock.disconnect).not.toHaveBeenCalled();
  });

  it('still replaces a socket that has given up or was rejected', () => {
    socketMock.active = false;
    getSocket('');
    getSocket('');

    expect(ioMock).toHaveBeenCalledTimes(2);
    expect(socketMock.disconnect).toHaveBeenCalledTimes(1);
  });

  it('falls back to polling when a WebSocket connection cannot be established', () => {
    getSocket('');

    expect(ioMock).toHaveBeenCalledOnce();
    expect(ioMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        transports: ['websocket', 'polling'],
        tryAllTransports: true,
        withCredentials: true,
      }),
    );
  });
});
