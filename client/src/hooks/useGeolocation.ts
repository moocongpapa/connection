import { useState, useEffect, useRef, useCallback } from 'react';
import { Location } from '../types';

export const useGeolocation = (onLocationUpdate?: (location: Location) => void) => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const latestLocationRef = useRef<Location | null>(null);
  const onLocationUpdateRef = useRef(onLocationUpdate);

  // Keep onLocationUpdate callback ref up-to-date
  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  const handlePosition = useCallback((position: GeolocationPosition) => {
    const newLocation: Location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp || Date.now(),
    };
    
    latestLocationRef.current = newLocation;
    setLocation(newLocation);

    if (onLocationUpdateRef.current) {
      onLocationUpdateRef.current(newLocation);
    }
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    console.warn('Geolocation watch error:', err.message);
    setError(err.message);
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('이 브라우저에서는 위치 정보(Geolocation)를 지원하지 않습니다.');
      return;
    }

    setIsTracking(true);
    setError(null);

    // Immediate one-time fetch
    navigator.geolocation.getCurrentPosition(
      handlePosition,
      handleError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Continuous watch
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      }
    );
  }, [handlePosition, handleError]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Periodic heartbeat broadcast (every 4 seconds) to ensure all connected peers stay in sync
  useEffect(() => {
    if (!isTracking) return;

    const intervalId = setInterval(() => {
      const current = latestLocationRef.current;
      if (current && onLocationUpdateRef.current) {
        onLocationUpdateRef.current({
          ...current,
          timestamp: Date.now(),
        });
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [isTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { location, error, isTracking, startTracking, stopTracking };
};
