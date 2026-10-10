import { describe, expect, it } from 'vitest';
import { extractRoomId } from '../src/utils/browserUtils';

describe('extractRoomId', () => {
  it('extracts room ID from full https URL', () => {
    expect(extractRoomId('https://connection.app/room/abc-123')).toBe('abc-123');
    expect(extractRoomId('http://localhost:5173/room/room_test_123')).toBe('room_test_123');
  });

  it('extracts room ID from URL with query params and hash', () => {
    expect(extractRoomId('https://connection.app/room/meeting-456?from=kakao#map')).toBe('meeting-456');
  });

  it('extracts room ID from relative path', () => {
    expect(extractRoomId('/room/my-secret-room')).toBe('my-secret-room');
    expect(extractRoomId('room/my-secret-room')).toBe('my-secret-room');
  });

  it('extracts plain room ID / code', () => {
    expect(extractRoomId('room123')).toBe('room123');
    expect(extractRoomId('meet_room-99')).toBe('meet_room-99');
    expect(extractRoomId('abc-def-ghi')).toBe('abc-def-ghi');
  });

  it('handles spaces and trimmed input', () => {
    expect(extractRoomId('  https://connection.app/room/spaced-id  ')).toBe('spaced-id');
    expect(extractRoomId('  clean-code  ')).toBe('clean-code');
  });

  it('returns null for empty or invalid inputs', () => {
    expect(extractRoomId('')).toBeNull();
    expect(extractRoomId('   ')).toBeNull();
    expect(extractRoomId('!@#$%^')).toBeNull();
    expect(extractRoomId('ab')).toBeNull(); // too short for stand-alone code
  });
});
