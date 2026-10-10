/**
 * Utilities for detecting in-app browsers (KakaoTalk, Instagram, etc.),
 * handling PWA deep linking / external browser escape,
 * and extracting room IDs from invite URLs or text.
 */

export function isKakaoTalk(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /KAKAOTALK/i.test(navigator.userAgent);
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /KAKAOTALK|NAVER|Line|Instagram|FB_IAB|FB4A|DaumApps/i.test(ua);
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

/**
 * Escapes from in-app browsers like KakaoTalk to external browsers (Chrome on Android, or external webview)
 */
export function openInExternalBrowser(targetUrl: string = window.location.href): void {
  if (typeof window === 'undefined') return;
  const isAndr = isAndroid();
  if (isAndr) {
    // Android Chrome Intent: Opens in Google Chrome or associated PWA
    const cleanUrl = targetUrl.replace(/^https?:\/\//i, '');
    const intentUrl = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
    window.location.href = intentUrl;
    return;
  }

  if (isKakaoTalk()) {
    // KakaoTalk custom scheme for opening external browser on supported versions
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(targetUrl)}`;
  }
}

/**
 * Extracts a room ID from a full URL, relative path, or direct room code.
 * Supported patterns:
 * - https://example.com/room/abc-123
 * - /room/abc-123
 * - room/abc-123
 * - abc-123 (direct room ID, alphanumeric with dashes/underscores, 4+ chars)
 */
export function extractRoomId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Check for /room/:id in string
  const roomMatch = trimmed.match(/\/room\/([a-zA-Z0-9_-]+)/i);
  if (roomMatch && roomMatch[1]) {
    return roomMatch[1];
  }

  // 2. Direct room code (alphanumeric, -, _, length 3~64)
  if (/^[a-zA-Z0-9_-]{3,64}$/.test(trimmed)) {
    return trimmed;
  }

  // 3. Try parsing as URL
  try {
    const urlStr = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(urlStr);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const roomIdx = segments.indexOf('room');
    if (roomIdx !== -1 && segments[roomIdx + 1]) {
      return segments[roomIdx + 1];
    }
    // Room ID passed as query parameter ?room=... or ?id=...
    const queryRoom = parsed.searchParams.get('room') || parsed.searchParams.get('id');
    if (queryRoom && /^[a-zA-Z0-9_-]{3,64}$/.test(queryRoom)) {
      return queryRoom;
    }
    // If the path consists of just 1 segment that matches room code pattern
    if (segments.length === 1 && /^[a-zA-Z0-9_-]{3,64}$/.test(segments[0])) {
      return segments[0];
    }
  } catch {
    // Ignore invalid URL
  }

  return null;
}
