import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRoom } from '../hooks/useRoom';
import { useSocketContext } from './SocketContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { useWakeLock } from '../hooks/useWakeLock';
import { useNativeLocation } from '../hooks/useNativeLocation';
import { nativeCall, type NativeSession } from '../utils/nativeBridge';
import { getSharingPreference, readStored, saveSharingPreference, writeStored } from '../utils/storage';
import type { Location, MeetingPoint, ProfileData } from '../types';

function useRoomState() {
  const { socket, isConnected } = useSocketContext();
  const roomHook = useRoom(socket);
  const visible = usePageVisibility();
  const nativeGeo = useNativeLocation();
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
  const geo = useGeolocation({ enabled: enabled && !nativeGeo.native, highAccuracy: precision === 'precise', onLocationUpdate });
  useEffect(() => {
    if (!isConnected || !roomHook.isRoomReady || !visible) return;
    roomHook.heartbeat();
    const timer = window.setInterval(roomHook.heartbeat, 20_000);
    return () => window.clearInterval(timer);
  }, [isConnected, roomHook.isRoomReady, roomHook.heartbeat, visible]);
  const joinRoom = useCallback(async (id: string, profile: ProfileData) => {
    ++sharingOperation.current;
    const nativeState = nativeGeo.native ? await nativeCall('status') : null;
    if (nativeState?.active && nativeState.roomId !== id) await nativeCall('stop');
    const desired = nativeState ? nativeState.active && nativeState.roomId === id : getSharingPreference(id);
    wantsRef.current = desired; setWantsSharing(desired);
    await roomHook.joinRoom(id, profile, desired);
  }, [roomHook.joinRoom, nativeGeo.native]);
  const createRoom = useCallback(async (profile: ProfileData) => {
    ++sharingOperation.current;
    wantsRef.current = false; setWantsSharing(false);
    if (nativeGeo.native) await nativeCall('stop');
    return roomHook.createRoom(profile);
  }, [roomHook.createRoom, nativeGeo.native]);
  const toggleSharing = useCallback(async (desired: boolean) => {
    const ticket = ++sharingOperation.current;
    wantsRef.current = desired; setWantsSharing(desired);
    if (roomHook.room) saveSharingPreference(roomHook.room.id, desired);
    try {
      if (!desired && nativeGeo.native) await nativeCall('stop');
      await roomHook.toggleSharing(desired);
      if (desired && nativeGeo.native && roomHook.room && socket?.connected) {
        const session = await new Promise<NativeSession>((resolve, reject) => {
          socket.timeout(10_000).emit('native:start', { roomId: roomHook.room!.id },
            (error: Error | null, response: { ok: boolean; room?: NativeSession; message?: string }) => {
              if (error || !response?.ok || !response.room) reject(new Error(response?.message || '백그라운드 공유를 준비하지 못했습니다.'));
              else resolve(response.room);
            });
        });
        if (ticket !== sharingOperation.current) return;
        await nativeCall('start', session);
      }
    }
    catch (problem) {
      if (ticket !== sharingOperation.current) return;
      if (desired) {
        wantsRef.current = false; setWantsSharing(false);
        if (roomHook.room) saveSharingPreference(roomHook.room.id, false);
        if (nativeGeo.native) { void nativeCall('stop').catch(() => {}); void roomHook.toggleSharing(false).catch(() => {}); }
      }
      roomHook.setError((problem as Error).message);
    }
  }, [roomHook.room?.id, roomHook.toggleSharing, roomHook.setError, nativeGeo.native, socket]);
  useEffect(() => {
    if (nativeGeo.native && nativeGeo.state.error) {
      wantsRef.current = false; setWantsSharing(false);
      if (roomHook.room) saveSharingPreference(roomHook.room.id, false);
      void roomHook.toggleSharing(false).catch(() => {});
    }
  }, [nativeGeo.native, nativeGeo.state.error, roomHook.room?.id, roomHook.toggleSharing]);
  const leaveRoom = useCallback(async () => {
    ++sharingOperation.current;
    wantsRef.current = false; setWantsSharing(false); setPickingPoint(null); setKeepScreen(false);
    if (nativeGeo.native) await nativeCall('stop');
    await roomHook.leaveRoom();
  }, [roomHook.leaveRoom, nativeGeo.native]);
  const setPrecision = (value: 'precise' | 'balanced') => { setPrecisionState(value); writeStored('connection_precision', value); };
  const panToLocation = useCallback((location: Location) => setTargetLocation({ ...location }), []);
  const chooseMeetingPoint = useCallback(async (point: MeetingPoint | null) => {
    try { await roomHook.setMeetingPoint(point); setPickingPoint(null); }
    catch (problem) { roomHook.setError((problem as Error).message); }
  }, [roomHook.setMeetingPoint, roomHook.setError]);
  return { ...roomHook, createRoom, joinRoom, leaveRoom, toggleSharing, isSharing, wantsSharing, serverSharing: ownMember?.isSharing === true,
    isNative: nativeGeo.native, nativeActive: nativeGeo.state.active,
    myLocation: nativeGeo.native ? nativeGeo.state.location ?? null : geo.location,
    locationStatus: nativeGeo.native ? nativeGeo.state.error ? 'unavailable' as const : nativeGeo.state.active ? nativeGeo.state.location ? 'live' as const : 'requesting' as const : 'idle' as const : geo.status,
    locationError: nativeGeo.native ? nativeGeo.state.error ?? null : geo.error,
    retryLocation: nativeGeo.native ? () => { void toggleSharing(true); } : geo.retry,
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
