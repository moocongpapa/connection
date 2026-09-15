import { Location } from '../types';

export const calculateDistance = (loc1: Location, loc2: Location): number => {
  const R = 6371e3; // metres
  const φ1 = (loc1.lat * Math.PI) / 180; // φ, λ in radians
  const φ2 = (loc2.lat * Math.PI) / 180;
  const Δφ = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const Δλ = ((loc2.lng - loc1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
};

export const isMoving = (prevLoc: Location | null, currLoc: Location, threshold: number = 5): boolean => {
  if (!prevLoc) return true;
  return calculateDistance(prevLoc, currLoc) > threshold;
};

export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

export const getUpdateInterval = (moving: boolean): number => {
  return moving ? 3000 : 10000;
};
