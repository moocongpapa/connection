import React, { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { useRoom } from '../hooks/useRoom';
import { useSocketContext } from './SocketContext';
import { Room, Member, ProfileData, Location } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';

interface RoomContextType {
  room: Room | null;
  members: Member[];
  isCreator: boolean;
  createRoom: (profile: ProfileData) => Promise<string>;
  joinRoom: (roomId: string, profile: ProfileData) => void;
  leaveRoom: () => void;
  toggleSharing: (isSharing: boolean) => void;
  error: string | null;
  myLocation: Location | null;
  isTracking: boolean;
  startTracking: () => void;
  stopTracking: () => void;
  targetLocation: Location | null;
  panToLocation: (location: Location) => void;
}

const RoomContext = createContext<RoomContextType | null>(null);

export const useRoomContext = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoomContext must be used within a RoomProvider');
  }
  return context;
};

export const RoomProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { socket } = useSocketContext();
  const roomHook = useRoom(socket);
  const [isSharingLocal, setIsSharingLocal] = useState(true);
  const [targetLocation, setTargetLocation] = useState<Location | null>(null);
  
  const handleLocationUpdate = useCallback((location: Location) => {
    if (isSharingLocal) {
      roomHook.updateLocation(location);
    }
  }, [isSharingLocal, roomHook.updateLocation]);

  const { location: myLocation, isTracking, startTracking, stopTracking } = useGeolocation(handleLocationUpdate);

  // Sync existing location to server as soon as room is joined
  useEffect(() => {
    if (roomHook.room && myLocation && isSharingLocal) {
      roomHook.updateLocation(myLocation);
    }
  }, [roomHook.room?.id, myLocation, isSharingLocal]);

  const toggleSharing = (isSharing: boolean) => {
    setIsSharingLocal(isSharing);
    roomHook.toggleSharing(isSharing);
  };

  const createRoom = useCallback((profile: ProfileData) => {
    return roomHook.createRoom(profile, myLocation);
  }, [roomHook.createRoom, myLocation]);

  const joinRoom = useCallback((roomId: string, profile: ProfileData) => {
    roomHook.joinRoom(roomId, profile, myLocation);
  }, [roomHook.joinRoom, myLocation]);

  const panToLocation = useCallback((location: Location) => {
    setTargetLocation({
      ...location,
      timestamp: Date.now(),
    });
  }, []);

  return (
    <RoomContext.Provider value={{ 
      ...roomHook, 
      createRoom,
      joinRoom,
      toggleSharing,
      myLocation,
      isTracking,
      startTracking,
      stopTracking,
      targetLocation,
      panToLocation,
    }}>
      {children}
    </RoomContext.Provider>
  );
};
