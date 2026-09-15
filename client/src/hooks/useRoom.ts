import { useState, useCallback, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Room, Member, ProfileData, Location } from '../types';

// Persistent client-side user ID to identify this user across reloads and reconnections
export const getOrCreateUserId = (): string => {
  let userId = localStorage.getItem('connection_user_id');
  if (!userId) {
    userId = 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem('connection_user_id', userId);
  }
  return userId;
};

export const useRoom = (socket: Socket | null) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const roomIdRef = useRef<string | null>(null);
  const lastKnownLocationRef = useRef<Location | null>(null);
  const userId = useRef<string>(getOrCreateUserId()).current;

  useEffect(() => {
    if (!socket) return;

    // Server emits 'room:created' with { roomId } after room:create
    socket.on('room:created', (data: { roomId: string }) => {
      const newRoom: Room = { id: data.roomId, members: [] };
      roomIdRef.current = data.roomId;
      setRoom(newRoom);
      setError(null);
    });

    // Server emits 'member:list' with Member[] when joining or when list updates
    socket.on('member:list', (memberList: Member[]) => {
      setMembers(memberList);
      if (roomIdRef.current) {
        setRoom({ id: roomIdRef.current, members: memberList });
      }
      setError(null);

      // If we already have a location, broadcast it immediately so everyone sees us
      if (lastKnownLocationRef.current) {
        socket.emit('location:update', {
          roomId: roomIdRef.current,
          lat: lastKnownLocationRef.current.lat,
          lng: lastKnownLocationRef.current.lng,
          accuracy: lastKnownLocationRef.current.accuracy,
          timestamp: Date.now(),
        });
      }
    });

    socket.on('room:error', (data: { message: string }) => {
      setError(data.message);
    });

    socket.on('member:joined', (member: Member) => {
      setMembers(prev => {
        const exists = prev.some(m => m.id === member.id);
        if (exists) {
          return prev.map(m => m.id === member.id ? member : m);
        }
        return [...prev, member];
      });

      // A new peer joined! Respond immediately with our current location so they can see us right away
      if (lastKnownLocationRef.current) {
        socket.emit('location:update', {
          roomId: roomIdRef.current,
          lat: lastKnownLocationRef.current.lat,
          lng: lastKnownLocationRef.current.lng,
          accuracy: lastKnownLocationRef.current.accuracy,
          timestamp: Date.now(),
        });
      }
    });

    socket.on('member:left', (data: { memberId: string }) => {
      setMembers(prev => prev.filter(m => m.id !== data.memberId));
    });

    // Server broadcasts location:update with { memberId (userId), location }
    socket.on('location:update', (data: { memberId: string; location: Location }) => {
      setMembers(prev => prev.map(m => 
        m.id === data.memberId 
          ? { ...m, location: data.location, lastUpdate: Date.now() } 
          : m
      ));
    });

    // Server broadcasts location:toggle with { memberId (userId), isSharing }
    socket.on('location:toggle', (data: { memberId: string; isSharing: boolean }) => {
      setMembers(prev => prev.map(m => 
        m.id === data.memberId 
          ? { ...m, isSharing: data.isSharing, location: data.isSharing ? m.location : null }
          : m
      ));
    });

    return () => {
      socket.off('room:created');
      socket.off('member:list');
      socket.off('room:error');
      socket.off('member:joined');
      socket.off('member:left');
      socket.off('location:update');
      socket.off('location:toggle');
    };
  }, [socket]);

  const createRoom = useCallback((profile: ProfileData, initialLocation?: Location | null): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      if (!socket) return reject('Socket not connected');
      
      setIsCreator(true);
      
      const handleCreated = (data: { roomId: string }) => {
        roomIdRef.current = data.roomId;
        resolve(data.roomId);
      };
      
      const handleError = (data: { message: string }) => {
        reject(data.message);
        socket.off('room:created', handleCreated);
      };
      
      socket.once('room:created', handleCreated);
      socket.once('room:error', handleError);
      
      socket.emit('room:create', {
        userId,
        nickname: profile.nickname,
        photoBase64: profile.photoBase64,
        location: initialLocation || lastKnownLocationRef.current,
      });
    });
  }, [socket, userId]);

  const joinRoom = useCallback((roomId: string, profile: ProfileData, initialLocation?: Location | null) => {
    if (!socket) return;
    roomIdRef.current = roomId;
    socket.emit('room:join', {
      roomId,
      userId,
      nickname: profile.nickname,
      photoBase64: profile.photoBase64,
      location: initialLocation || lastKnownLocationRef.current,
    });
  }, [socket, userId]);

  const leaveRoom = useCallback(() => {
    if (socket && roomIdRef.current) {
      socket.emit('room:leave', { roomId: roomIdRef.current });
      roomIdRef.current = null;
      setRoom(null);
      setMembers([]);
      setIsCreator(false);
    }
  }, [socket]);

  const toggleSharing = useCallback((isSharing: boolean) => {
    if (socket) {
      socket.emit('location:toggle', { roomId: roomIdRef.current, isSharing });
      setMembers(prev => prev.map(m => 
        m.id === userId 
          ? { ...m, isSharing, location: isSharing ? m.location : null }
          : m
      ));
    }
  }, [socket, userId]);

  const updateLocation = useCallback((location: Location) => {
    lastKnownLocationRef.current = location;
    if (socket) {
      socket.emit('location:update', {
        roomId: roomIdRef.current,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
      });
      // Also update our own member entry locally
      setMembers(prev => prev.map(m => 
        m.id === userId 
          ? { ...m, location, lastUpdate: Date.now() } 
          : m
      ));
    }
  }, [socket, userId]);

  return { 
    room, 
    members, 
    isCreator, 
    userId,
    createRoom, 
    joinRoom, 
    leaveRoom, 
    toggleSharing, 
    updateLocation,
    error 
  };
};
