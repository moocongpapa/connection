import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { Location, MeetingPoint, ProfileData, Room } from '../types';
import { forgetRoom, getIdentity, saveRecentRoom } from '../utils/storage';
import { isFreshLocation } from '../utils/locationUtils';

interface Response { ok: boolean; room?: Room; message?: string }
export function useRoom(socket: Socket | null) {
  const [identity] = useState(getIdentity);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setJoining] = useState(false);
  const [isRoomReady, setReady] = useState(false);
  const activeRef = useRef<{ id: string; profile: ProfileData; isSharing: boolean } | null>(null);
  const readyRef = useRef(false);
  const operation = useRef(0);
  const sharingOperation = useRef(0);

  const request = useCallback((event: string, data: unknown): Promise<Response> => new Promise((resolve, reject) => {
    if (!socket?.connected) return reject(new Error('인터넷 연결을 확인해주세요. 자동으로 다시 연결합니다.'));
    socket.timeout(10000).emit(event, data, (problem: Error | null, response: Response) => {
      if (problem) return reject(new Error('서버 응답이 늦습니다. 잠시 후 다시 시도해주세요.'));
      if (!response?.ok) return reject(new Error(response?.message ?? '요청을 처리하지 못했습니다.'));
      resolve(response);
    });
  }), [socket]);
  const apply = useCallback((next: Room) => {
    if (next.id === activeRef.current?.id) setRoom(current =>
      current?.id !== next.id ? next : current.revision > next.revision ? current : {
        ...next,
        // A delayed full snapshot may precede a newer position delta from another server.
        members: next.members.map(member => {
          const previous = current.members.find(value => value.id === member.id);
          return previous?.isSharing && member.isSharing && previous.location &&
            previous.location.timestamp > (member.location?.timestamp ?? 0)
              ? { ...member, location: previous.location, lastSeenAt: Math.max(member.lastSeenAt, previous.lastSeenAt) } : member;
        }),
      });
  }, []);
  const joinRoom = useCallback(async (id: string, profile: ProfileData, isSharing = false) => {
    const ticket = ++operation.current;
    activeRef.current = { id, profile, isSharing };
    readyRef.current = false; setReady(false); setJoining(true); setError(null);
    try {
      const response = await request('room:join', { roomId: id, ...profile, isSharing });
      if (ticket !== operation.current || !socket?.connected) return;
      if (response.room) { apply(response.room); saveRecentRoom(id); }
      readyRef.current = true; setReady(true);
    } catch (problem) {
      if (ticket === operation.current) setError((problem as Error).message);
    } finally { if (ticket === operation.current) setJoining(false); }
  }, [apply, request, socket]);
  const createRoom = useCallback(async (profile: ProfileData): Promise<string> => {
    const ticket = ++operation.current;
    setJoining(true); setError(null);
    try {
      const response = await request('room:create', { ...profile, isSharing: false });
      if (!response.room || ticket !== operation.current || !socket?.connected) throw new Error('모임을 만들지 못했습니다. 다시 시도해주세요.');
      activeRef.current = { id: response.room.id, profile, isSharing: false };
      apply(response.room); readyRef.current = true; setReady(true); saveRecentRoom(response.room.id);
      return response.room.id;
    } finally { if (ticket === operation.current) setJoining(false); }
  }, [apply, request, socket]);

  useEffect(() => {
    if (!socket) return;
    const state = (next: Room) => apply(next);
    const location = (data: { roomId: string; revision: number; memberId: string; location: Location; lastSeenAt: number }) => {
      setRoom(current => current && current.id === data.roomId && current.revision <= data.revision ? { ...current, members: current.members.map(member =>
        member.id === data.memberId && member.isSharing && (!member.location || data.location.timestamp > member.location.timestamp)
          ? { ...member, location: data.location, lastSeenAt: data.lastSeenAt, isOnline: true } : member,
      ) } : current);
    };
    const presence = (data: { roomId: string; revision: number; memberId: string; lastSeenAt: number }) => {
      setRoom(current => current && current.id === data.roomId && current.revision <= data.revision ? { ...current, members: current.members.map(member =>
        member.id === data.memberId && data.lastSeenAt >= member.lastSeenAt ? { ...member, lastSeenAt: data.lastSeenAt, isOnline: true } : member,
      ) } : current);
    };
    const disconnect = () => { readyRef.current = false; setReady(false); };
    const connect = () => {
      const active = activeRef.current;
      if (active) void joinRoom(active.id, active.profile, active.isSharing);
    };
    const failure = (data: { message: string }) => setError(data.message);
    socket.on('room:state', state); socket.on('location:update', location);
    socket.on('member:presence', presence);
    socket.on('disconnect', disconnect); socket.on('connect', connect); socket.on('room:error', failure);
    return () => {
      socket.off('room:state', state); socket.off('location:update', location);
      socket.off('member:presence', presence);
      socket.off('disconnect', disconnect); socket.off('connect', connect); socket.off('room:error', failure);
    };
  }, [socket, apply, joinRoom]);

  const toggleSharing = useCallback(async (isSharing: boolean) => {
    if (!activeRef.current) return;
    const ticket = ++sharingOperation.current;
    activeRef.current.isSharing = isSharing;
    if (!socket?.connected || !readyRef.current) {
      if (isSharing) { activeRef.current.isSharing = false; throw new Error('모임에 다시 연결한 뒤 공유를 시작해주세요.'); }
      return;
    }
    const active = activeRef.current;
    try {
      const response = await request('location:toggle', { roomId: active.id, isSharing });
      if (response.room) apply(response.room);
    } catch (problem) {
      if (isSharing && ticket === sharingOperation.current && activeRef.current === active) active.isSharing = false;
      throw problem;
    }
  }, [apply, request, socket]);
  const updateLocation = useCallback((location: Location) => {
    const active = activeRef.current;
    if (!socket?.connected || !readyRef.current || !active?.isSharing || !isFreshLocation(location)) return;
    // Volatile samples are never buffered and replayed after an offline interval.
    socket.volatile.emit('location:update', { roomId: active.id, location });
  }, [socket]);
  const heartbeat = useCallback(() => {
    if (socket?.connected && readyRef.current && activeRef.current) socket.volatile.emit('member:heartbeat', { roomId: activeRef.current.id });
  }, [socket]);
  const leaveRoom = useCallback(async () => {
    const active = activeRef.current;
    ++operation.current; activeRef.current = null; readyRef.current = false;
    setReady(false); setRoom(null); setJoining(false); setError(null);
    if (!active) return;
    forgetRoom(active.id);
    if (socket?.connected) await request('room:leave', { roomId: active.id });
  }, [request, socket]);
  const setMeetingPoint = useCallback(async (point: MeetingPoint | null) => {
    if (!activeRef.current || !readyRef.current) throw new Error('모임에 다시 연결해주세요.');
    const response = await request('room:meeting-point', { roomId: activeRef.current.id, point });
    if (response.room) apply(response.room);
  }, [apply, request]);
  return { room, members: room?.members ?? [], userId: identity.userId, isCreator: room?.creatorId === identity.userId,
    error, setError, isJoining, isRoomReady, createRoom, joinRoom, leaveRoom, toggleSharing, updateLocation, heartbeat, setMeetingPoint };
}
