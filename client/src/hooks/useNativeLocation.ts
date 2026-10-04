import { useEffect, useState } from 'react';
import { nativeCall, observeNative, isNativeApp } from '../utils/nativeBridge';
import type { NativeState } from '../utils/nativeBridge';

export function useNativeLocation() {
  const native = isNativeApp();
  const [state, setState] = useState<NativeState>({ active: false });
  useEffect(() => {
    if (!native) return;
    const off = observeNative(next => setState(previous => ({ ...next, location: next.active ? next.location ?? previous.location : undefined })));
    void nativeCall('status').catch(() => {});
    const resume = () => { if (document.visibilityState === 'visible') void nativeCall('status').catch(() => {}); };
    document.addEventListener('visibilitychange', resume);
    return () => { off(); document.removeEventListener('visibilitychange', resume); };
  }, [native]);
  return { native, state };
}
