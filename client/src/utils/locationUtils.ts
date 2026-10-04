import { Location, Member } from '../types';

export const STALE_AFTER = 30_000;
export const isFreshLocation = (location: Location | null, now = Date.now()) =>
  !!location && now - location.timestamp <= STALE_AFTER && location.timestamp <= now + 5000;
export const isMemberLocationFresh = (member: Member, now = Date.now()) =>
  !!member.location && member.location.timestamp <= now + 5000 &&
  now - member.location.timestamp <= (member.backgroundSharing ? 5 * 60_000 : STALE_AFTER);
export const calculateDistance = (loc1: Pick<Location, 'lat' | 'lng'>, loc2: Pick<Location, 'lat' | 'lng'>): number => {
  const radians = Math.PI / 180;
  const deltaLat = (loc2.lat - loc1.lat) * radians;
  const deltaLng = (loc2.lng - loc1.lng) * radians;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(loc1.lat * radians) * Math.cos(loc2.lat * radians) * Math.sin(deltaLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
};
export const isMoving = (prev: Location | null, current: Location) =>
  !prev || calculateDistance(prev, current) > Math.max(5, Math.min(30, (current.accuracy ?? 0) / 2));
export const formatDistance = (meters: number) => meters < 1000 ? Math.round(meters) + 'm' : (meters / 1000).toFixed(1) + 'km';
export const getUpdateInterval = (moving: boolean) => moving ? 3000 : 10000;
export function formatLocationAge(timestamp: number, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 5) return '방금 측정';
  if (seconds < 60) return seconds + '초 전 측정';
  return Math.floor(seconds / 60) + '분 전 측정';
}
export const directionsUrl = (location: Pick<Location, 'lat' | 'lng'>) =>
  'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(location.lat + ',' + location.lng);
