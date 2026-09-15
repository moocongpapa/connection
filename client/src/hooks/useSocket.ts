import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!socketInstance) {
      const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;
      socketInstance = io(serverUrl, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });
    }

    setSocket(socketInstance);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);

    if (socketInstance.connected) {
      setIsConnected(true);
    }

    return () => {
      if (socketInstance) {
        socketInstance.off('connect', onConnect);
        socketInstance.off('disconnect', onDisconnect);
      }
    };
  }, []);

  return { socket, isConnected };
};
