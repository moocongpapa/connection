import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRoom } from '../hooks/useRoom';
import { useSocketContext } from './SocketContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { useWakeLock } from '../hooks/useWakeLock';
import { getSharingPreference, readStored, saveSharingPreference, writeStored } from '../utils/storage';
import type { Location, MeetingPoint, ProfileData } from '../types';

function useRoomState() {
  const { socket, isConnected } = useSocketContext();
  const roomHook = useRoom(socket);
  const visible = usePageVisibility();
  const [wantsSharing, setWantsSharing] = useState(false);
  const wantsRef = useRef(false);
  const sharingOperation = useRef(0);
  const [precision, setPrecisionState] = useState<'precise' | 'balanced'>(() => readStored('connection_precision', 'precise'));
  const [targetLocation, setTargetLocation] = useState<Location | null>(null);
  const [pickingPoint, setPickingPoint] = useState<string | null>(null);
  const ownMember = roomHook.members.find(member => member.id === roomHook.userId);
  const isSharing = wantsSharing && ownMember?.isSharing === true;
  const enabled = isSharing && isConnected && roomHook.isRoomReady && visible;
  const [keepScreen, setKeepScreen] = useState(false);
  const wake = useWakeLock(keepScreen && enabled);
  const onLocationUpdate = useCallback((location: Location) => {
    if (wantsRef.current) roomHook.updateLocation(location);
  }, [roomHook.updateLocation]);
  const geo = useGeolocation({ enabled, highAccuracy: precision === 'precise', onLocationUpdate });
  useEffect(() => {
    if (!isConnected || !roomHook.isRoomReady || !visible) return;
    roomHook.heartbeat();
    const timer = window.setInterval(roomHook.heartbeat, 20_000);
    return () => window.clearInterval(timer);
  }, [isConnected, roomHook.isRoomReady, roomHook.heartbeat, visible]);
  const joinRoom = useCallback(async (id: string, profile: ProfileData) => {
    ++sharingOperation.current;
    const desired = getSharingPreference(id);
    wantsRef.current = desired; setWantsSharing(desired);
    await roomHook.joinRoom(id, profile, desired);
  }, [roomHook.joinRoom]);
  const createRoom = useCallback(async (profile: ProfileData) => {
    ++sharingOperation.current;
    wantsRef.current = false; setWantsSharing(false);
    return roomHook.createRoom(profile);
  }, [roomHook.createRoom]);
  const toggleSharing = useCallback(async (desired: boolean) => {
    const ticket = ++sharingOperation.current;
    wantsRef.current = desired; setWantsSharing(desired);
    if (roomHook.room) saveSharingPreference(roomHook.room.id, desired);
    try { await roomHook.toggleSharing(desired); }
    catch (problem) {
      if (ticket !== sharingOperation.current) return;
      if (desired) {
        wantsRef.current = false; setWantsSharing(false);
        if (roomHook.room) saveSharingPreference(roomHook.room.id, false);
      }
      roomHook.setError((problem as Error).message);
    }
  }, [roomHook.room?.id, roomHook.toggleSharing, roomHook.setError]);
  const leaveRoom = useCallback(async () => {
    ++sharingOperation.current;
    wantsRef.current = false; setWantsSharing(false); setPickingPoint(null); setKeepScreen(false);
    await roomHook.leaveRoom();
  }, [roomHook.leaveRoom]);
  const setPrecision = (value: 'precise' | 'balanced') => { setPrecisionState(value); writeStored('connection_precision', value); };
  const panToLocation = useCallback((location: Location) => setTargetLocation({ ...location }), []);
  const chooseMeetingPoint = useCallback(async (point: MeetingPoint | null) => {
    try { await roomHook.setMeetingPoint(point); setPickingPoint(null); }
    catch (problem) { roomHook.setError((problem as Error).message); }
  }, [roomHook.setMeetingPoint, roomHook.setError]);
  return { ...roomHook, createRoom, joinRoom, leaveRoom, toggleSharing, isSharing, wantsSharing, serverSharing: ownMember?.isSharing === true,
    myLocation: geo.location, locationStatus: geo.status, locationError: geo.error, retryLocation: geo.retry,
    precision, setPrecision, visible, targetLocation, panToLocation, pickingPoint, setPickingPoint,
    chooseMeetingPoint, keepScreen, setKeepScreen, wake };
}
const RoomContext = createContext<ReturnType<typeof useRoomState> | null>(null);
export function useRoomContext() {
  const context = useContext(RoomContext);
  if (!context) throw new Error('RoomProvider is required');
  return context;
}
export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useRoomState();
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};
