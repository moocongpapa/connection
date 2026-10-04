import { nanoid } from 'nanoid';
import { createHash, randomBytes } from 'node:crypto';
import type { RoomRepository } from './RoomRepository.js';

export interface Location { lat: number; lng: number; accuracy?: number; timestamp: number }
export interface MeetingPoint { lat: number; lng: number; label: string }
export interface Member {
  id: string; nickname: string; photoBase64: string; location: Location | null;
  isSharing: boolean; isOnline: boolean; joinedAt: number; lastSeenAt: number;
  backgroundSharing?: boolean;
}
export interface StoredMember extends Member {
  socketId: string; tokenHash: string;
  nativeGrant?: { hash: string; expiresAt: number; lastUploadAt: number };
}
export interface StoredRoom {
  id: string; creatorId: string; members: Record<string, StoredMember>;
  meetingPoint: MeetingPoint | null; createdAt: number; expiresAt: number; revision: number;
}
export interface Room extends Omit<StoredRoom, 'members'> { members: Member[] }
export const ROOM_TTL = 24 * 60 * 60 * 1000;
export const PRESENCE_TTL = 60_000;
export const MAX_LOCATION_AGE = 60_000;
export const publicMember = (member: StoredMember): Member => ({
  id: member.id, nickname: member.nickname, photoBase64: member.photoBase64,
  location: member.isSharing ? member.location : null, isSharing: member.isSharing,
  isOnline: member.isOnline && Date.now() - member.lastSeenAt < PRESENCE_TTL,
  joinedAt: member.joinedAt, lastSeenAt: member.lastSeenAt,
  backgroundSharing: !!(member.isSharing && member.nativeGrant && member.nativeGrant.expiresAt > Date.now()),
});
export const publicRoom = (room: StoredRoom): Room => ({
  id: room.id, creatorId: room.creatorId, members: Object.values(room.members).map(publicMember),
  meetingPoint: room.meetingPoint, createdAt: room.createdAt, expiresAt: room.expiresAt, revision: room.revision,
});

export class RoomStore {
  constructor(private repository: RoomRepository) {}
  async createRoom(member: StoredMember): Promise<Room> {
    const now = Date.now();
    const room: StoredRoom = {
      id: nanoid(16), creatorId: member.id, members: { [member.id]: member },
      meetingPoint: null, createdAt: now, expiresAt: now + ROOM_TTL, revision: 0,
    };
    await this.repository.create(room);
    return publicRoom(room);
  }
  async getRoom(id: string): Promise<Room | null> {
    const room = await this.repository.read(id);
    return room ? publicRoom(room) : null;
  }
  async joinRoom(id: string, member: StoredMember): Promise<Room> {
    const room = await this.repository.mutate(id, current => {
      const existing = current.members[member.id];
      if (existing && existing.tokenHash !== member.tokenHash) throw new Error('참여자 인증에 실패했습니다.');
      current.members[member.id] = { ...member, joinedAt: existing?.joinedAt ?? member.joinedAt,
        location: member.isSharing && existing?.nativeGrant ? existing.location : null,
        nativeGrant: member.isSharing ? existing?.nativeGrant : undefined };
      if (!current.members[current.creatorId]) current.creatorId = member.id;
      if (Object.keys(current.members).length > 100) throw new Error('모임에는 최대 100명까지 참여할 수 있습니다.');
    });
    return publicRoom(room);
  }
  async updateLocation(id: string, userId: string, socketId: string, location: Location): Promise<{ member: Member; revision: number } | null> {
    let updated: StoredMember | null = null;
    const room = await this.repository.mutate(id, room => {
      updated = null;
      const member = room.members[userId];
      if (!member || member.socketId !== socketId || !member.isSharing) return;
      if (Date.now() - location.timestamp > MAX_LOCATION_AGE) return;
      if (member.location && location.timestamp <= member.location.timestamp) return;
      member.location = location; member.lastSeenAt = Date.now(); member.isOnline = true;
      updated = member;
    });
    return updated ? { member: publicMember(updated), revision: room.revision } : null;
  }
  async toggleSharing(id: string, userId: string, socketId: string, isSharing: boolean): Promise<Room> {
    return publicRoom(await this.repository.mutate(id, room => {
      const member = this.requireMember(room, userId, socketId);
      member.isSharing = isSharing; member.location = null; member.lastSeenAt = Date.now();
      if (!isSharing) delete member.nativeGrant;
    }));
  }
  async heartbeat(id: string, userId: string, socketId: string) {
    const room = await this.repository.mutate(id, room => {
      const member = this.requireMember(room, userId, socketId);
      member.lastSeenAt = Date.now(); member.isOnline = true;
    });
    return { member: publicMember(room.members[userId]), revision: room.revision };
  }
  async setOffline(id: string, userId: string, socketId: string): Promise<Room | null> {
    try {
      return publicRoom(await this.repository.mutate(id, room => {
        const member = room.members[userId];
        if (member?.socketId === socketId) member.isOnline = false;
      }, false));
    } catch { return null; }
  }
  async startNativeSharing(id: string, userId: string, socketId: string) {
    const uploadToken = randomBytes(32).toString('base64url');
    const room = await this.repository.mutate(id, room => {
      const member = this.requireMember(room, userId, socketId);
      if (!member.isSharing) throw new Error('위치 공유를 먼저 켜주세요.');
      member.nativeGrant = { hash: createHash('sha256').update(uploadToken).digest('hex'),
        expiresAt: Math.min(room.expiresAt, Date.now() + 8 * 60 * 60 * 1000), lastUploadAt: 0 };
    });
    return { room: publicRoom(room), session: { roomId: id, userId, uploadToken,
      expiresAt: room.members[userId].nativeGrant!.expiresAt } };
  }
  async nativeUpdate(id: string, userId: string, uploadToken: string, location: Location | null) {
    let changed = false;
    const hash = createHash('sha256').update(uploadToken).digest('hex');
    const room = await this.repository.mutate(id, room => {
      changed = false;
      const member = room.members[userId];
      if (!member?.isSharing || !member.nativeGrant || member.nativeGrant.hash !== hash ||
          (location && member.nativeGrant.expiresAt <= Date.now())) throw new Error('Native sharing session expired');
      if (!location) {
        member.isSharing = false; member.location = null; delete member.nativeGrant; changed = true; return;
      }
      if (Date.now() - location.timestamp > MAX_LOCATION_AGE ||
          (member.location && location.timestamp <= member.location.timestamp) ||
          Date.now() - member.nativeGrant.lastUploadAt < 60_000) return;
      member.location = location; member.lastSeenAt = Date.now();
      member.nativeGrant.lastUploadAt = Date.now(); changed = true;
      // A native upload is not evidence that the WebSocket is connected.
    });
    return { room: publicRoom(room), changed };
  }
  async leaveRoom(id: string, userId: string, socketId: string): Promise<Room> {
    return publicRoom(await this.repository.mutate(id, room => {
      this.requireMember(room, userId, socketId);
      delete room.members[userId];
      if (room.creatorId === userId) room.creatorId = Object.keys(room.members)[0] ?? '';
    }));
  }
  async setMeetingPoint(id: string, userId: string, socketId: string, point: MeetingPoint | null): Promise<Room> {
    return publicRoom(await this.repository.mutate(id, room => {
      this.requireMember(room, userId, socketId);
      if (room.creatorId !== userId) throw new Error('모임을 만든 사람만 만날 장소를 변경할 수 있습니다.');
      room.meetingPoint = point;
    }));
  }
  private requireMember(room: StoredRoom, userId: string, socketId: string): StoredMember {
    const member = room.members[userId];
    if (!member || member.socketId !== socketId) throw new Error('모임에 다시 연결해주세요.');
    return member;
  }
}
