import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function useSocket(eventId) {
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialize Socket.IO connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (eventId) {
        socket.emit('join:event', eventId);
      }
    });

    if (eventId) {
      socket.emit('join:event', eventId);
    }

    return () => {
      if (eventId) {
        socket.emit('leave:event', eventId);
      }
      socket.disconnect();
    };
  }, [eventId]);

  return socketRef.current;
}
