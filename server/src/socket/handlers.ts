import { Server, Socket } from 'socket.io';
import { RoomStore, Member, Location } from '../models/Room.js';
import * as events from './events.js';
import { scheduleCleanup, cancelCleanup } from '../utils/roomCleanup.js';

export function registerSocketHandlers(io: Server, socket: Socket, roomStore: RoomStore) {
  
  socket.on(events.ROOM_CREATE, (data: { userId?: string; nickname: string; photoBase64: string; location?: Location }) => {
    try {
      const room = roomStore.createRoom();
      const userId = data.userId || socket.id;
      const member: Member = {
        id: userId,
        socketId: socket.id,
        nickname: data.nickname,
        photoBase64: data.photoBase64,
        location: data.location || null,
        isSharing: true,
        isOnline: true,
        joinedAt: Date.now(),
        lastUpdate: Date.now(),
      };
      
      roomStore.upsertMember(room.id, member);
      socket.join(room.id);
      
      socket.emit(events.ROOM_CREATED, { roomId: room.id });
      socket.emit(events.MEMBER_LIST, [member]);

      console.log(`[Room Create] Room ${room.id} created by ${data.nickname} (User: ${userId}, Socket: ${socket.id})`);
    } catch (error) {
      console.error('[Room Create Error]', error);
      socket.emit(events.ROOM_ERROR, { message: 'Failed to create room.' });
    }
  });

  socket.on(events.ROOM_JOIN, (data: { roomId: string; userId?: string; nickname: string; photoBase64: string; location?: Location }) => {
    const { roomId, nickname, photoBase64, location } = data;
    
    if (!roomStore.roomExists(roomId)) {
      socket.emit(events.ROOM_ERROR, { message: 'Room does not exist.' });
      return;
    }

    const userId = data.userId || socket.id;
    const member: Member = {
      id: userId,
      socketId: socket.id,
      nickname,
      photoBase64,
      location: location || null,
      isSharing: true,
      isOnline: true,
      joinedAt: Date.now(),
      lastUpdate: Date.now(),
    };

    roomStore.upsertMember(roomId, member);
    cancelCleanup(roomStore, roomId); // Room is active, cancel any cleanup timer
    
    socket.join(roomId);
    
    const members = roomStore.getRoomMembers(roomId);
    
    // Broadcast the full updated member list to EVERYONE in the room
    io.in(roomId).emit(events.MEMBER_LIST, members);
    socket.to(roomId).emit(events.MEMBER_JOINED, member);
    
    console.log(`[Room Join] ${nickname} (User: ${userId}, Socket: ${socket.id}) joined ${roomId}. Total members: ${members.length}`);
  });

  socket.on(events.LOCATION_UPDATE, (data: { roomId?: string; lat: number; lng: number; accuracy?: number; timestamp: number }) => {
    let targetRooms: string[] = [];
    if (data.roomId && roomStore.roomExists(data.roomId)) {
      targetRooms = [data.roomId];
      if (!socket.rooms.has(data.roomId)) {
        socket.join(data.roomId);
      }
    } else {
      targetRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    }

    for (const roomId of targetRooms) {
      const updatedMember = roomStore.updateLocation(roomId, socket.id, data);
      if (updatedMember) {
        socket.to(roomId).emit(events.LOCATION_UPDATE, {
          memberId: updatedMember.id, // Broadcast persistent member userId
          location: {
            lat: data.lat,
            lng: data.lng,
            accuracy: data.accuracy,
            timestamp: data.timestamp,
          },
        });
      }
    }
  });

  socket.on(events.LOCATION_TOGGLE, (data: { roomId?: string; isSharing: boolean }) => {
    let targetRooms: string[] = [];
    if (data.roomId && roomStore.roomExists(data.roomId)) {
      targetRooms = [data.roomId];
    } else {
      targetRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    }

    for (const roomId of targetRooms) {
      const updatedMember = roomStore.toggleSharing(roomId, socket.id, data.isSharing);
      if (updatedMember) {
        socket.to(roomId).emit(events.LOCATION_TOGGLE, {
          memberId: updatedMember.id,
          isSharing: data.isSharing,
        });
      }
    }
  });

  // Explicit leave: User manually clicks "나가기 (Leave)"
  const handleExplicitLeave = (roomId: string) => {
    const member = roomStore.getRoomMembers(roomId).find(m => m.socketId === socket.id);
    const userId = member?.id || socket.id;

    if (roomStore.removeMemberExplicitly(roomId, socket.id)) {
      socket.leave(roomId);
      socket.to(roomId).emit(events.MEMBER_LEFT, { memberId: userId });
      
      const remainingMembers = roomStore.getRoomMembers(roomId);
      io.in(roomId).emit(events.MEMBER_LIST, remainingMembers);

      console.log(`[Explicit Leave] User ${userId} left room ${roomId}. Remaining: ${remainingMembers.length}`);
      
      // Only schedule cleanup if literally EVERY member has explicitly left (0 members remain)
      if (roomStore.isEmpty(roomId)) {
        scheduleCleanup(roomStore, roomId);
        console.log(`[Room Empty] All members explicitly left room ${roomId}. 24-hour retention scheduled.`);
      }
    }
  };

  socket.on(events.ROOM_LEAVE, (data: { roomId: string }) => {
    handleExplicitLeave(data.roomId);
  });

  // Disconnect: socket disconnected (tab closed, reload, screen lock, background)
  // We mark member offline instead of deleting, keeping the room and member completely intact!
  socket.on('disconnecting', () => {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    for (const roomId of rooms) {
      const offlineMember = roomStore.setMemberOffline(roomId, socket.id);
      if (offlineMember) {
        const members = roomStore.getRoomMembers(roomId);
        // Inform peers that this member is temporarily offline, but DO NOT delete room
        io.in(roomId).emit(events.MEMBER_LIST, members);
        console.log(`[Socket Offline] User ${offlineMember.nickname} (${offlineMember.id}) offline in room ${roomId}. Room preserved.`);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Disconnect] Socket ${socket.id} closed.`);
  });
}
