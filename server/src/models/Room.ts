import { nanoid } from 'nanoid';

export interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
}

export interface Member {
  id: string;           // userId (persistent client identifier)
  socketId: string;     // active Socket.IO connection id
  nickname: string;
  photoBase64: string;  // profile photo
  location: Location | null;
  isSharing: boolean;   // location sharing toggle
  isOnline: boolean;    // connection status
  joinedAt: number;
  lastUpdate: number;
}

export interface Room {
  id: string;           // nanoid generated
  members: Map<string, Member>; // Map<userId, Member>
  createdAt: number;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

export class RoomStore {
  private rooms: Map<string, Room> = new Map();

  createRoom(): Room {
    const id = nanoid(8);
    const room: Room = {
      id,
      members: new Map(),
      createdAt: Date.now(),
      cleanupTimer: null,
    };
    this.rooms.set(id, room);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  // Add or update member (keyed by userId)
  upsertMember(roomId: string, member: Member): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const existing = room.members.get(member.id);
    if (existing) {
      existing.socketId = member.socketId;
      existing.nickname = member.nickname;
      existing.photoBase64 = member.photoBase64;
      existing.isOnline = true;
      if (member.location) {
        existing.location = member.location;
      }
      existing.lastUpdate = Date.now();
      room.members.set(member.id, existing);
    } else {
      room.members.set(member.id, member);
    }
    return true;
  }

  // Set member offline (socket disconnected, but user has NOT intentionally left)
  setMemberOffline(roomId: string, socketId: string): Member | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    for (const member of room.members.values()) {
      if (member.socketId === socketId) {
        member.isOnline = false;
        member.lastUpdate = Date.now();
        return member;
      }
    }
    return null;
  }

  // Explicitly remove member when user clicks "Leave Room"
  removeMemberExplicitly(roomId: string, userIdOrSocketId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    // Check by userId first
    if (room.members.has(userIdOrSocketId)) {
      return room.members.delete(userIdOrSocketId);
    }

    // Fallback: check by socketId
    for (const [userId, member] of room.members.entries()) {
      if (member.socketId === userIdOrSocketId) {
        return room.members.delete(userId);
      }
    }
    return false;
  }

  updateLocation(roomId: string, socketId: string, location: Location): Member | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    for (const member of room.members.values()) {
      if (member.socketId === socketId) {
        member.location = location;
        member.isOnline = true;
        member.lastUpdate = Date.now();
        return member;
      }
    }
    return null;
  }

  toggleSharing(roomId: string, socketId: string, isSharing: boolean): Member | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    for (const member of room.members.values()) {
      if (member.socketId === socketId) {
        member.isSharing = isSharing;
        if (!isSharing) {
          member.location = null;
        }
        member.lastUpdate = Date.now();
        return member;
      }
    }
    return null;
  }

  getRoomMembers(roomId: string): Member[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.members.values());
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room && room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
    }
    this.rooms.delete(roomId);
  }

  setCleanupTimer(roomId: string, callback: () => void, delay: number): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
    }
    room.cleanupTimer = setTimeout(callback, delay);
  }

  clearCleanupTimer(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }
  }

  roomExists(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  // Room is empty only if 0 members exist in the room
  isEmpty(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return true;
    return room.members.size === 0;
  }
}
