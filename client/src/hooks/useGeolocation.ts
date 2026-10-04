import { useCallback, useEffect, useRef, useState } from 'react';
import type { Location, LocationStatus } from '../types';
import { getUpdateInterval, isFreshLocation, isMoving } from '../utils/locationUtils';

interface Options { enabled: boolean; highAccuracy?: boolean; onLocationUpdate?: (location: Location) => void }
export function useGeolocation({ enabled, highAccuracy = true, onLocationUpdate }: Options) {
  const [location, setLocation] = useState<Location | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const callbackRef = useRef(onLocationUpdate);
  callbackRef.current = onLocationUpdate;
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (!enabled) { setStatus('idle'); setError(null); setLocation(null); return; }
    if (!window.isSecureContext) {
      setStatus('insecure'); setError('위치 공유는 HTTPS 주소에서 사용할 수 있습니다.'); return;
    }
    if (!navigator.geolocation) {
      setStatus('unsupported'); setError('이 브라우저는 위치 공유를 지원하지 않습니다. Safari 또는 Chrome으로 열어주세요.'); return;
    }
    let active = true;
    let watchId: number | null = null;
    let sendTimer: ReturnType<typeof setTimeout> | null = null;
    let sampleTimer: ReturnType<typeof setTimeout> | null = null;
    let latest: Location | null = null;
    let lastSent: Location | null = null;
    let lastSentAt = 0;
    let moving = false;
    setStatus('requesting'); setError(null); setLocation(null);
    const stop = () => {
      active = false;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (sendTimer) clearTimeout(sendTimer);
      if (sampleTimer) clearTimeout(sampleTimer);
    };
    const sendLatest = () => {
      sendTimer = null;
      if (!active || !latest || !isFreshLocation(latest) || latest.timestamp <= (lastSent?.timestamp ?? 0)) return;
      callbackRef.current?.(latest);
      lastSent = latest; lastSentAt = Date.now();
    };
    const onPosition = (position: GeolocationPosition) => {
      if (!active) return;
      const next: Location = {
        lat: position.coords.latitude, lng: position.coords.longitude,
        accuracy: position.coords.accuracy, timestamp: position.timestamp,
      };
      if (!isFreshLocation(next) || next.timestamp <= (latest?.timestamp ?? 0)) return;
      moving = isMoving(latest, next);
      latest = next; setLocation(next); setStatus('live'); setError(null);
      const delay = getUpdateInterval(isMoving(lastSent, next)) - (Date.now() - lastSentAt);
      if (sendTimer) { clearTimeout(sendTimer); sendTimer = null; }
      if (!lastSent || delay <= 0) sendLatest();
      else sendTimer = setTimeout(sendLatest, delay);
    };
    const onError = (problem: GeolocationPositionError) => {
      if (!active) return;
      const messages: Record<number, [LocationStatus, string]> = {
        1: ['denied', '위치 권한이 꺼져 있습니다. 브라우저의 사이트 설정에서 위치를 허용한 뒤 다시 시도해주세요.'],
        2: ['unavailable', '위치를 확인하지 못했습니다. 기기의 위치 서비스를 확인하고 다시 시도해주세요.'],
        3: ['timeout', '위치 확인에 시간이 걸립니다. 창가나 야외에서 다시 시도해주세요.'],
      };
      const [nextStatus, message] = messages[problem.code] ?? messages[2];
      setStatus(nextStatus); setError(message);
      if (sendTimer) { clearTimeout(sendTimer); sendTimer = null; }
      if (problem.code === 1) stop();
    };
    const options = { enableHighAccuracy: highAccuracy, maximumAge: 0, timeout: 15000 };
    const scheduleSample = () => {
      if (active) sampleTimer = setTimeout(sample, getUpdateInterval(moving));
    };
    const sample = () => {
      if (!active) return;
      // Request a new sensor reading; never manufacture a fresh timestamp for an old coordinate.
      navigator.geolocation.getCurrentPosition(
        position => { onPosition(position); scheduleSample(); },
        problem => { onError(problem); scheduleSample(); },
        options,
      );
    };
    sample();
    if (active) watchId = navigator.geolocation.watchPosition(onPosition, onError, options);
    if (!active && watchId !== null) navigator.geolocation.clearWatch(watchId);
    return stop;
  }, [enabled, highAccuracy, attempt]);
  return { location, status, error, retry };
}
