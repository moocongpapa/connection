import { createHash } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { RoomStore, MAX_LOCATION_AGE, type Location, type MeetingPoint, type StoredMember } from '../models/Room.js';

type Ack = (response: { ok: boolean; room?: unknown; message?: string }) => void;
const validRoomId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
const coordinate = (lat: unknown, lng: unknown) =>
  typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90 &&
  typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180;
export const validateLocation = (value: unknown): value is Location => {
  if (!value || typeof value !== 'object') return false;
  const location = value as Location;
  return coordinate(location.lat, location.lng) && Number.isFinite(location.timestamp) &&
    location.timestamp <= Date.now() + 5000 && Date.now() - location.timestamp <= MAX_LOCATION_AGE &&
    (location.accuracy === undefined || (Number.isFinite(location.accuracy) && location.accuracy >= 0 && location.accuracy <= 100_000));
};
export function validateIdentity(socket: Socket): boolean {
  const { userId, token } = socket.handshake.auth;
  return typeof userId === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(userId) &&
    typeof token === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(token);
}
export function registerSocketHandlers(io: Server, socket: Socket, store: RoomStore) {
  const userId: string = socket.handshake.auth.userId;
  const tokenHash = createHash('sha256').update(socket.handshake.auth.token).digest('hex');
  let activeRoom: string | null = null;
  let queue = Promise.resolve();
  let lastLocationAt = 0;
  let lastHeartbeatAt = 0;
  const handle = (event: string, action: (data: any) => Promise<unknown>) => {
    socket.on(event, (data: unknown, ack?: Ack) => {
      queue = queue.then(async () => {
        try {
          if (!socket.connected) return;
          const room = await action(data);
          if (typeof ack === 'function') ack({ ok: true, ...(room ? { room } : {}) });
        } catch (error) {
          const message = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
          if (typeof ack === 'function') ack({ ok: false, message });
          else socket.emit('room:error', { message });
        }
      });
    });
  };
  const requireRoom = (data: any): string => {
    if (!data || !validRoomId(data.roomId) || data.roomId !== activeRoom || !socket.rooms.has(data.roomId)) throw new Error('모임에 다시 연결해주세요.');
    return data.roomId;
  };
  const makeMember = (data: any): StoredMember => {
    if (!data || typeof data.nickname !== 'string' || !data.nickname.trim() || data.nickname.trim().length > 20) throw new Error('닉네임은 1~20자로 입력해주세요.');
    if (typeof data.photoBase64 !== 'string' || data.photoBase64.length > 100_000 ||
      (data.photoBase64 && !/^data:image\/(jpeg|png|webp|gif|svg\+xml);base64,/.test(data.photoBase64))) throw new Error('프로필 사진 형식을 확인해주세요.');
    return {
      id: userId, socketId: socket.id, tokenHash, nickname: data.nickname.trim(),
      photoBase64: data.photoBase64, location: null, isSharing: data.isSharing === true,
      isOnline: true, joinedAt: Date.now(), lastSeenAt: Date.now(),
    };
  };
  const leavePrevious = async (next?: string) => {
    if (activeRoom && activeRoom !== next) {
      const oldId = activeRoom;
      await socket.leave(oldId);
      const previous = await store.setOffline(oldId, userId, socket.id);
      if (previous) io.to(oldId).emit('room:state', previous);
      activeRoom = null;
    }
  };
  handle('room:create', async data => {
    const member = makeMember(data);
    await leavePrevious();
    const room = await store.createRoom(member);
    activeRoom = room.id; await socket.join(room.id);
    return room;
  });
  handle('room:join', async data => {
    if (!data || !validRoomId(data.roomId)) throw new Error('초대 링크가 올바르지 않습니다.');
    const member = makeMember(data);
    await leavePrevious(data.roomId);
    const room = await store.joinRoom(data.roomId, member);
    activeRoom = room.id; await socket.join(room.id);
    io.to(room.id).emit('room:state', room);
    return room;
  });
  handle('location:toggle', async data => {
    const id = requireRoom(data);
    if (typeof data.isSharing !== 'boolean') throw new Error('공유 상태를 확인해주세요.');
    const room = await store.toggleSharing(id, userId, socket.id, data.isSharing);
    io.to(id).emit('room:state', room);
    return room;
  });
  handle('location:update', async data => {
    const id = requireRoom(data);
    if (!validateLocation(data.location)) throw new Error('오래되었거나 올바르지 않은 위치입니다.');
    if (Date.now() - lastLocationAt < 1000) return;
    lastLocationAt = Date.now();
    const updated = await store.updateLocation(id, userId, socket.id, data.location);
    if (updated) io.to(id).emit('location:update', { roomId: id, revision: updated.revision, memberId: userId, location: updated.member.location, lastSeenAt: updated.member.lastSeenAt });
  });
  handle('member:heartbeat', async data => {
    const id = requireRoom(data);
    if (Date.now() - lastHeartbeatAt < 10_000) return;
    lastHeartbeatAt = Date.now();
    const updated = await store.heartbeat(id, userId, socket.id);
    io.to(id).emit('member:presence', { roomId: id, memberId: userId, revision: updated.revision, lastSeenAt: updated.member.lastSeenAt });
  });
  handle('room:meeting-point', async data => {
    const id = requireRoom(data);
    const point: MeetingPoint | null = data.point;
    if (point !== null && (!point || !coordinate(point.lat, point.lng) || typeof point.label !== 'string' || !point.label.trim() || point.label.length > 40)) throw new Error('만날 장소 이름과 위치를 확인해주세요.');
    const room = await store.setMeetingPoint(id, userId, socket.id, point);
    io.to(id).emit('room:state', room); return room;
  });
  handle('room:leave', async data => {
    const id = requireRoom(data);
    const room = await store.leaveRoom(id, userId, socket.id);
    await socket.leave(id); activeRoom = null; io.to(id).emit('room:state', room);
  });
  socket.on('disconnect', () => {
    queue = queue.then(async () => {
      if (!activeRoom) return;
      const id = activeRoom; activeRoom = null;
      const room = await store.setOffline(id, userId, socket.id);
      if (room) io.to(id).emit('room:state', room);
    }).catch(error => console.error('Failed to update disconnected participant', error instanceof Error ? error.message : 'Unknown error'));
  });
  return () => queue;
}
