import type { Location } from '../types';

export interface NativeSession { roomId: string; userId: string; uploadToken: string; expiresAt: number }
export interface NativeState { active: boolean; roomId?: string; location?: Location; error?: string }
type Reply = NativeState & { id?: string; ok?: boolean };
declare global {
  interface Window {
    webkit?: { messageHandlers?: { connectionNative?: { postMessage(value: unknown): void } } };
    ConnectionNative?: { postMessage(value: string): void; onmessage?: (event: { data: string }) => void };
    connectionNativeReceive?: (value: Reply) => void;
  }
}
export const isNativeApp = () => !!(window.webkit?.messageHandlers?.connectionNative || window.ConnectionNative);
const pending = new Map<string, { resolve(value: NativeState): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
const listeners = new Set<(state: NativeState) => void>();
window.connectionNativeReceive = value => {
  if (value.id && pending.has(value.id)) {
    const entry = pending.get(value.id)!; pending.delete(value.id); clearTimeout(entry.timer);
    if (value.ok === false) entry.reject(new Error(value.error || '위치 권한을 확인해주세요.'));
    else entry.resolve(value);
  }
  for (const listener of listeners) listener(value);
};
export function observeNative(listener: (state: NativeState) => void) {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
export function nativeCall(action: 'status' | 'start' | 'stop', session?: NativeSession): Promise<NativeState> {
  if (!isNativeApp()) return Promise.reject(new Error('설치형 앱에서 사용할 수 있습니다.'));
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('앱의 위치 권한 요청을 확인해주세요.')); }, 90_000);
    pending.set(id, { resolve, reject, timer });
    const value = { id, action, session };
    try {
      if (window.webkit?.messageHandlers?.connectionNative) window.webkit.messageHandlers.connectionNative.postMessage(value);
      else window.ConnectionNative!.postMessage(JSON.stringify(value));
    } catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
}

if (window.ConnectionNative) window.ConnectionNative.onmessage = event => {
  try { window.connectionNativeReceive?.(JSON.parse(event.data)); } catch { /* Ignore malformed native messages. */ }
};
