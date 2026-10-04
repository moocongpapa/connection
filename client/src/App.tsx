import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import CreateRoom from './components/Room/CreateRoom';
import JoinRoom from './components/Room/JoinRoom';
import MobileLayout from './components/Layout/MobileLayout';
import DesktopLayout from './components/Layout/DesktopLayout';
import { SocketProvider, useSocketContext } from './contexts/SocketContext';
import { RoomProvider, useRoomContext } from './contexts/RoomContext';
import { useTheme } from './hooks/useTheme';
import { getProfile } from './utils/storage';
import { useMediaQuery } from './hooks/useMediaQuery';

const RoomContainer: React.FC = () => {
  const { roomId } = useParams();
  const { room, joinRoom, isJoining } = useRoomContext();
  const { isConnected } = useSocketContext();
  const mobile = useMediaQuery('(max-width: 767px)');
  const attempted = useRef<string | null>(null);
  useEffect(() => {
    if (!roomId || room?.id === roomId || !isConnected || isJoining || attempted.current === roomId) return;
    attempted.current = roomId;
    const profile = getProfile();
    if (profile) void joinRoom(roomId, profile);
  }, [roomId, room?.id, isConnected, isJoining, joinRoom]);
  if (!roomId) return <Navigate to="/" />;
  if (!room || room.id !== roomId) return <JoinRoom />;
  return mobile ? <MobileLayout /> : <DesktopLayout />;
};
const AppContent: React.FC = () => {
  useTheme();
  return <BrowserRouter><RoomProvider><Routes>
    <Route path="/" element={<CreateRoom />} />
    <Route path="/room/:roomId" element={<RoomContainer />} />
    <Route path="*" element={<Navigate to="/" />} />
  </Routes></RoomProvider></BrowserRouter>;
};
export default function App() { return <SocketProvider><AppContent /></SocketProvider>; }
