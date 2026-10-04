import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getIdentity } from '../utils/storage';

export function useSocket() {
  const [socket] = useState(() => io(import.meta.env.VITE_SERVER_URL || window.location.origin, {
    autoConnect: false, transports: ['websocket'], path: '/socket.io',
    auth: getIdentity(), reconnection: true, reconnectionAttempts: Infinity,
    reconnectionDelay: 1000, reconnectionDelayMax: 10000, timeout: 10000,
  }));
  const [isConnected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  useEffect(() => {
    const connect = () => { setConnected(true); setConnectionError(null); };
    const disconnect = () => setConnected(false);
    const failure = (error: Error) => { setConnected(false); setConnectionError(error.message); };
    socket.on('connect', connect); socket.on('disconnect', disconnect); socket.on('connect_error', failure);
    socket.connect();
    return () => {
      socket.off('connect', connect); socket.off('disconnect', disconnect); socket.off('connect_error', failure);
      socket.disconnect();
    };
  }, [socket]);
  return { socket, isConnected, connectionError };
}
