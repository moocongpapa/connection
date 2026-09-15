import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom';
import CreateRoom from './components/Room/CreateRoom';
import JoinRoom from './components/Room/JoinRoom';
import MobileLayout from './components/Layout/MobileLayout';
import DesktopLayout from './components/Layout/DesktopLayout';
import { SocketProvider, useSocketContext } from './contexts/SocketContext';
import { RoomProvider, useRoomContext } from './contexts/RoomContext';
import { useTheme } from './hooks/useTheme';

const RoomContainer: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, joinRoom, error, isTracking, startTracking } = useRoomContext();
  const { isConnected } = useSocketContext();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [autoRejoinAttempted, setAutoRejoinAttempted] = useState(false);

  const hasSavedProfile = !!localStorage.getItem('connection_profile');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-rejoin when refreshing the page if profile exists in localStorage
  useEffect(() => {
    if (!room && roomId && isConnected && !autoRejoinAttempted) {
      try {
        const savedProfileStr = localStorage.getItem('connection_profile');
        if (savedProfileStr) {
          const profile = JSON.parse(savedProfileStr);
          if (profile.nickname) {
            joinRoom(roomId, profile);
            setAutoRejoinAttempted(true);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to parse saved profile:', err);
      }
      setAutoRejoinAttempted(true);
    }
  }, [room, roomId, isConnected, autoRejoinAttempted, joinRoom]);

  // If room:error occurs, ensure we stop showing loading and let JoinRoom display error
  useEffect(() => {
    if (error) {
      setAutoRejoinAttempted(true);
    }
  }, [error]);

  // Ensure location tracking starts when joining a room
  useEffect(() => {
    if (room && !isTracking) {
      startTracking();
    }
  }, [room, isTracking, startTracking]);

  if (!roomId) return <Navigate to="/" />;

  // Show loading spinner while attempting auto-rejoin with saved profile
  if (!room && hasSavedProfile && !autoRejoinAttempted && !error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-700 dark:text-gray-300 font-semibold text-sm animate-pulse">
          모임에 다시 연결하는 중입니다...
        </p>
      </div>
    );
  }

  if (!room) {
    return <JoinRoom />;
  }

  return isMobile ? <MobileLayout /> : <DesktopLayout />;
};

const AppContent: React.FC = () => {
  useTheme(); // Initialize theme

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <RoomProvider>
            <CreateRoom />
          </RoomProvider>
        } />
        <Route path="/room/:roomId" element={
          <RoomProvider>
            <RoomContainer />
          </RoomProvider>
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

const App: React.FC = () => {
  return (
    <SocketProvider>
      <AppContent />
    </SocketProvider>
  );
};

export default App;
