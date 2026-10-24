'use client';

import { io, Socket } from 'socket.io-client';
import { session } from './api';

let socket: Socket | null = null;

/** One shared Socket.IO connection, authenticated with the access JWT. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000', {
      auth: { token: session.get()?.accessToken },
      autoConnect: true,
    });
  }
  return socket;
}

export function resetSocket() {
  socket?.disconnect();
  socket = null;
}
