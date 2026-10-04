export interface Location { lat: number; lng: number; accuracy?: number; timestamp: number }
export interface MeetingPoint { lat: number; lng: number; label: string }
export interface Member {
  id: string; nickname: string; photoBase64: string; location: Location | null;
  isSharing: boolean; isOnline: boolean; joinedAt: number; lastSeenAt: number;
}
export interface Room {
  id: string; creatorId: string; members: Member[]; meetingPoint: MeetingPoint | null;
  createdAt: number; expiresAt: number; revision: number;
}
export interface ProfileData { nickname: string; photoBase64: string }
export type LocationStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure';
