import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNativeApp, nativeCall, observeNative } from '../src/utils/nativeBridge';
import { isMemberLocationFresh } from '../src/utils/locationUtils';
import type { Member } from '../src/types';

afterEach(() => { delete window.webkit; delete window.ConnectionNative; vi.useRealTimers(); });

describe('native sharing bridge', () => {
  it('does not enable native access in the regular browser', async () => {
    expect(isNativeApp()).toBe(false);
    await expect(nativeCall('start')).rejects.toThrow('설치형 앱');
  });
  it('matches replies by request ID and propagates permission denial', async () => {
    const sent: any[] = [];
    window.webkit = { messageHandlers: { connectionNative: { postMessage: value => sent.push(value) } } };
    const status = nativeCall('status');
    const stop = nativeCall('stop');
    window.connectionNativeReceive!({ id: sent[1].id, ok: true, active: false });
    expect((await stop).active).toBe(false);
    window.connectionNativeReceive!({ id: sent[0].id, ok: false, active: false, error: '권한 거부' });
    await expect(status).rejects.toThrow('권한 거부');
  });
  it('publishes native samples and stops delivering after unsubscribe', () => {
    const listener = vi.fn(); const off = observeNative(listener);
    window.connectionNativeReceive!({ active: true, roomId: 'testroom' });
    expect(listener).toHaveBeenCalledOnce(); off();
    window.connectionNativeReceive!({ active: false }); expect(listener).toHaveBeenCalledOnce();
  });
  it('keeps low frequency samples distinct from live web samples', () => {
    const now = Date.now();
    const member = { backgroundSharing: true, location: { lat: 0, lng: 0, timestamp: now - 120_000 } } as Member;
    expect(isMemberLocationFresh(member, now)).toBe(true);
    expect(isMemberLocationFresh({ ...member, backgroundSharing: false }, now)).toBe(false);
    expect(isMemberLocationFresh(member, now + 6 * 60_000)).toBe(false);
  });
});
