import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGeolocation } from '../src/hooks/useGeolocation';

let successes: PositionCallback[];
let failures: PositionErrorCallback[];
let watcher: PositionCallback;
let watchError: PositionErrorCallback;
const get = vi.fn(); const watch = vi.fn(); const clear = vi.fn();
function position(offset = 0, timestamp = Date.now()): GeolocationPosition {
  return { timestamp, coords: { latitude: 37.5 + offset, longitude: 127, accuracy: 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) }, toJSON: () => ({}) };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(1_800_000_000_000);
  successes = []; failures = []; get.mockReset(); watch.mockReset(); clear.mockReset();
  get.mockImplementation((ok, fail) => { successes.push(ok); failures.push(fail); });
  watch.mockImplementation((ok, fail) => { watcher = ok; watchError = fail; return 12; });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: get, watchPosition: watch, clearWatch: clear } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('sensor lifecycle and consent', () => {
  it('starts only with explicit consent and ignores callbacks after OFF', () => {
    const update = vi.fn();
    const hook = renderHook(({ enabled }) => useGeolocation({ enabled, onLocationUpdate: update }), { initialProps: { enabled: false } });
    expect(get).not.toHaveBeenCalled(); expect(watch).not.toHaveBeenCalled();
    hook.rerender({ enabled: true });
    act(() => successes[0](position()));
    expect(update).toHaveBeenCalledTimes(1);
    hook.rerender({ enabled: false });
    act(() => { vi.advanceTimersByTime(20_000); watcher(position(.001)); });
    expect(clear).toHaveBeenCalledWith(12);
    expect(update).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledTimes(1);
    expect(hook.result.current.location).toBeNull(); expect(hook.result.current.status).toBe('idle');
  });
  it('denial reports the permission problem, stops sampling, and retry creates a new watch', () => {
    const hook = renderHook(() => useGeolocation({ enabled: true }));
    act(() => watchError({ code: 1, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }));
    expect(hook.result.current.status).toBe('denied');
    expect(clear).toHaveBeenCalledWith(12);
    act(() => vi.advanceTimersByTime(60_000));
    expect(get).toHaveBeenCalledTimes(1);
    act(() => hook.result.current.retry());
    expect(watch).toHaveBeenCalledTimes(2); expect(hook.result.current.status).toBe('requesting');
  });
  it('never changes an old timestamp or keeps broadcasting the same reading', () => {
    const update = vi.fn();
    renderHook(() => useGeolocation({ enabled: true, onLocationUpdate: update }));
    const original = position();
    act(() => successes[0](original));
    act(() => vi.advanceTimersByTime(10_000));
    act(() => successes[1](original));
    act(() => vi.advanceTimersByTime(60_000));
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].timestamp).toBe(original.timestamp);
  });
  it('samples a stationary sensor again and sends a newly measured timestamp', () => {
    const update = vi.fn();
    renderHook(() => useGeolocation({ enabled: true, onLocationUpdate: update }));
    act(() => successes[0](position()));
    act(() => vi.advanceTimersByTime(3000));
    act(() => successes[1](position()));
    act(() => vi.advanceTimersByTime(7000));
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1][0].timestamp).toBe(1_800_000_003_000);
    act(() => vi.advanceTimersByTime(3000));
    expect(get).toHaveBeenCalledTimes(3);
  });
  it('moving readings accelerate a pending stationary transmission to three seconds', () => {
    const update = vi.fn();
    renderHook(() => useGeolocation({ enabled: true, onLocationUpdate: update }));
    act(() => successes[0](position()));
    act(() => vi.advanceTimersByTime(1000));
    act(() => watcher(position()));
    act(() => vi.advanceTimersByTime(1000));
    act(() => watcher(position(.001)));
    act(() => vi.advanceTimersByTime(1000));
    expect(update).toHaveBeenCalledTimes(2); expect(update.mock.calls[1][0].lat).toBe(37.501);
  });
  it('uses lower accuracy when the user selects battery mode', () => {
    renderHook(() => useGeolocation({ enabled: true, highAccuracy: false }));
    expect(get.mock.calls[0][2].enableHighAccuracy).toBe(false);
  });
  it('reports insecure contexts instead of starting a watch', () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    const hook = renderHook(() => useGeolocation({ enabled: true }));
    expect(hook.result.current.status).toBe('insecure'); expect(watch).not.toHaveBeenCalled();
  });
});
