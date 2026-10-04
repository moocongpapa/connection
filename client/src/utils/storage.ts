import type { ProfileData } from '../types';

export function readStored<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
export function writeStored(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The app also works with storage disabled. */ }
}
let volatileIdentity: { userId: string; token: string } | null = null;
export function getIdentity() {
  const saved = readStored<{ userId: string; token: string } | null>('connection_identity_v1', null);
  if (typeof saved?.userId === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(saved.userId) && typeof saved.token === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(saved.token)) return saved;
  if (!volatileIdentity) {
    volatileIdentity = { userId: 'usr_' + crypto.randomUUID(), token: crypto.randomUUID() + crypto.randomUUID() };
  }
  writeStored('connection_identity_v1', volatileIdentity);
  return volatileIdentity;
}
export function getProfile(): ProfileData | null {
  const profile = readStored<ProfileData | null>('connection_profile', null);
  return profile && typeof profile.nickname === 'string' && profile.nickname.trim() && typeof profile.photoBase64 === 'string' ? profile : null;
}
export const getSharingPreference = (roomId: string) => readStored<boolean>('connection_sharing_' + roomId, false) === true;
export const saveSharingPreference = (roomId: string, value: boolean) => writeStored('connection_sharing_' + roomId, value);
export interface RecentRoom { id: string; visitedAt: number }
export function getRecentRooms(): RecentRoom[] {
  const rooms = readStored<unknown>('connection_recent_rooms', []);
  return Array.isArray(rooms) ? rooms.filter((room): room is RecentRoom => typeof room?.id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(room.id) && typeof room.visitedAt === 'number' && Number.isFinite(room.visitedAt)) : [];
}
export function saveRecentRoom(id: string) {
  const rooms = getRecentRooms();
  writeStored('connection_recent_rooms', [{ id, visitedAt: Date.now() }, ...rooms.filter(room => room.id !== id)].slice(0, 5));
  writeStored('connection_active_room', id);
}
export function forgetRoom(id: string) {
  saveSharingPreference(id, false);
  writeStored('connection_recent_rooms', getRecentRooms().filter(room => room.id !== id));
  writeStored('connection_active_room', null);
}
