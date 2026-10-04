import { useEffect, useState } from 'react';
interface ScreenLock { release(): Promise<void>; addEventListener(name: string, listener: () => void): void }
type WakeNavigator = Navigator & { wakeLock?: { request(kind: 'screen'): Promise<ScreenLock> } };
export function useWakeLock(enabled: boolean) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = !!(navigator as WakeNavigator).wakeLock;
  useEffect(() => {
    if (!enabled || !supported) return;
    let disposed = false;
    let lock: ScreenLock | null = null;
    setError(null);
    void (navigator as WakeNavigator).wakeLock!.request('screen').then(async acquired => {
      if (disposed) { await acquired.release(); return; }
      lock = acquired; setActive(true);
      acquired.addEventListener('release', () => { if (!disposed) setActive(false); });
    }).catch(() => { if (!disposed) setError('이 기기에서는 화면 유지가 일시적으로 제한됩니다.'); });
    return () => { disposed = true; setActive(false); void lock?.release().catch(() => undefined); };
  }, [enabled, supported]);
  return { active, error, supported };
}
