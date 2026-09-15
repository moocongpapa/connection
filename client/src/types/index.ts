export interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
}

export interface Member {
  id: string;           // persistent userId
  socketId?: string;
  nickname: string;
  photoBase64: string;
  location: Location | null;
  isSharing: boolean;
  isOnline?: boolean;
  joinedAt: number;
  lastUpdate: number;
}

export interface Room {
  id: string;
  members: Member[];
}

export interface ProfileData {
  nickname: string;
  photoBase64: string;
}
