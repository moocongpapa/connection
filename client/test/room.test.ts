import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { useRoom } from '../src/hooks/useRoom';
import { getIdentity } from '../src/utils/storage';
import type { Room } from '../src/types';
const profile = { nickname: '테스트', photoBase64: '' };
let listeners: Map<string, Set<(data?: any) => void>>;
let room: Room;
let socket: any;
let requests: Array<{ event: string; data: any }>;
let rejectToggle: boolean;
function notify(event: string, value?: any) { listeners.get(event)?.forEach(callback => callback(value)); }
beforeEach(() => {
  localStorage.clear(); listeners = new Map(); requests = []; rejectToggle = false;
  const now = Date.now(); const id = getIdentity().userId;
  room = { id: 'room123456789abc', creatorId: id, meetingPoint: null, createdAt: now, expiresAt: now + 100_000, revision: 1,
    members: [{ id, ...profile, location: null, isSharing: false, isOnline: true, joinedAt: now, lastSeenAt: now }] };
  socket = { connected: true, volatile: { emit: vi.fn() },
    on: (event: string, callback: any) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event)!.add(callback); },
    off: (event: string, callback: any) => listeners.get(event)?.delete(callback),
    timeout: () => ({ emit: (event: string, data: any, ack: any) => {
      requests.push({ event, data });
      if (event === 'location:toggle' && rejectToggle) return ack(null, { ok: false, message: '연결 오류' });
      if (event === 'room:join' || event === 'location:toggle') room = { ...room, revision: room.revision + 1, members: room.members.map(m => ({ ...m, isSharing: data.isSharing === true, location: null })) };
      ack(null, { ok: true, room: event === 'room:leave' ? undefined : structuredClone(room) });
    } }),
  };
});
afterEach(cleanup);
it('rejoins on reconnect with the existing profile and OFF preference', async () => {
  const hook = renderHook(() => useRoom(socket as Socket));
  await act(() => hook.result.current.joinRoom(room.id, profile, false));
  act(() => { socket.connected = false; notify('disconnect'); });
  expect(hook.result.current.isRoomReady).toBe(false);
  await act(async () => { socket.connected = true; notify('connect'); });
  expect(requests.filter(r => r.event === 'room:join')).toHaveLength(2);
  expect(requests.at(-1)?.data).toEqual({ roomId: room.id, ...profile, isSharing: false });
  expect(hook.result.current.isRoomReady).toBe(true);
});
it('offline coordinates are dropped and fresh online coordinates use volatile delivery', async () => {
  const hook = renderHook(() => useRoom(socket as Socket));
  await act(() => hook.result.current.joinRoom(room.id, profile, true));
  const location = { lat: 37, lng: 127, timestamp: Date.now() };
  act(() => hook.result.current.updateLocation(location));
  expect(socket.volatile.emit).toHaveBeenCalledTimes(1);
  act(() => { socket.connected = false; notify('disconnect'); hook.result.current.updateLocation(location); });
  expect(socket.volatile.emit).toHaveBeenCalledTimes(1);
  await act(async () => { socket.connected = true; notify('connect'); });
  act(() => hook.result.current.updateLocation({ ...location, timestamp: Date.now() - 40_000 }));
  expect(socket.volatile.emit).toHaveBeenCalledTimes(1);
});
it('failed sharing ON cannot silently enable sharing on the next reconnect', async () => {
  const hook = renderHook(() => useRoom(socket as Socket));
  await act(() => hook.result.current.joinRoom(room.id, profile));
  rejectToggle = true;
  await act(async () => { await expect(hook.result.current.toggleSharing(true)).rejects.toThrow('연결 오류'); });
  act(() => { socket.connected = false; notify('disconnect'); });
  await act(async () => { socket.connected = true; notify('connect'); });
  expect(requests.at(-1)?.data.isSharing).toBe(false);
});
it('delayed snapshots and updates from another room cannot resurrect a hidden location', async () => {
  const hook = renderHook(() => useRoom(socket as Socket));
  await act(() => hook.result.current.joinRoom(room.id, profile, true));
  const old = structuredClone(room);
  await act(() => hook.result.current.toggleSharing(false));
  act(() => notify('room:state', old));
  act(() => notify('location:update', { roomId: 'other123456', revision: 999, memberId: room.members[0].id, location: { lat: 37, lng: 127, timestamp: Date.now() }, lastSeenAt: Date.now() }));
  expect(hook.result.current.members[0].isSharing).toBe(false);
  expect(hook.result.current.members[0].location).toBeNull();
});
it('leaving clears consent and does not rejoin after a reconnect', async () => {
  const hook = renderHook(() => useRoom(socket as Socket));
  await act(() => hook.result.current.joinRoom(room.id, profile, true));
  await act(() => hook.result.current.leaveRoom());
  const count = requests.length;
  await act(async () => notify('connect'));
  expect(requests).toHaveLength(count); expect(hook.result.current.room).toBeNull();
  expect(JSON.parse(localStorage.getItem('connection_sharing_' + room.id)!)).toBe(false);
});
it('a newer location delta cannot hide a participant arriving in an earlier full snapshot', async () => {
  const hook = renderHook(() => useRoom(socket as Socket));
  await act(() => hook.result.current.joinRoom(room.id, profile, true));
  const location = { lat: 37, lng: 127, timestamp: Date.now() };
  act(() => notify('location:update', { roomId: room.id, revision: 10, memberId: room.members[0].id, location, lastSeenAt: Date.now() }));
  act(() => notify('room:state', { ...room, revision: 9, members: [...room.members, { ...room.members[0], id: 'other-user', nickname: '친구' }] }));
  expect(hook.result.current.members).toHaveLength(2);
  expect(hook.result.current.members[0].location).toEqual(location);
});
it('presence packets do not make an old sensor reading appear fresh', async () => {
  const hook = renderHook(() => useRoom(socket as Socket));
  await act(() => hook.result.current.joinRoom(room.id, profile, true));
  const location = { lat: 37, lng: 127, timestamp: Date.now() - 40_000 };
  act(() => notify('location:update', { roomId: room.id, revision: 5, memberId: room.members[0].id, location, lastSeenAt: Date.now() - 10_000 }));
  act(() => notify('member:presence', { roomId: room.id, revision: 6, memberId: room.members[0].id, lastSeenAt: Date.now() }));
  expect(hook.result.current.members[0].location?.timestamp).toBe(location.timestamp);
  expect(hook.result.current.members[0].lastSeenAt).toBeGreaterThan(location.timestamp);
});
