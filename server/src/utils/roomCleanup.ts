import { RoomStore } from '../models/Room.js';

// Grace period: Keep rooms alive for 24 hours even if all participants temporarily leave
export const CLEANUP_DELAY = 24 * 60 * 60 * 1000; // 24 hours

export function scheduleCleanup(roomStore: RoomStore, roomId: string) {
  roomStore.setCleanupTimer(roomId, () => {
    console.log(`[Cleanup] Room ${roomId} deleted after 24 hours of inactivity.`);
    roomStore.deleteRoom(roomId);
  }, CLEANUP_DELAY);
}

export function cancelCleanup(roomStore: RoomStore, roomId: string) {
  roomStore.clearCleanupTimer(roomId);
}
