import React, { createContext, useContext } from 'react';
import { useSocket } from '../hooks/useSocket';

const SocketContext = createContext<ReturnType<typeof useSocket> | null>(null);
export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useSocket();
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
export function useSocketContext() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('SocketProvider is required');
  return context;
}
