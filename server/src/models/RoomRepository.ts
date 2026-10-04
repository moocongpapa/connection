import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { WatchError, type createClient } from 'redis';
import { ROOM_TTL, type StoredRoom } from './Room.js';

export interface RoomRepository {
  create(room: StoredRoom): Promise<void>;
  read(id: string): Promise<StoredRoom | null>;
  mutate(id: string, update: (room: StoredRoom) => void, extendTTL?: boolean): Promise<StoredRoom>;
}
export class FileRoomRepository implements RoomRepository {
  private rooms: Record<string, StoredRoom> = {};
  private queue: Promise<unknown>;
  constructor(private path: string | null) { this.queue = this.load(); }
  private async load() {
    if (!this.path) return;
    try {
      this.rooms = JSON.parse(await readFile(this.path, 'utf8'));
      for (const room of Object.values(this.rooms)) {
        for (const member of Object.values(room.members)) member.isOnline = false;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  private run<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.then(action);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private async save(next: Record<string, StoredRoom>) {
    for (const [id, room] of Object.entries(next)) if (room.expiresAt <= Date.now()) delete next[id];
    if (this.path) {
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = this.path + '.' + process.pid + '.tmp';
      await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
      await rename(temporary, this.path);
    }
    this.rooms = next;
  }
  create(room: StoredRoom): Promise<void> {
    return this.run(() => this.save({ ...this.rooms, [room.id]: structuredClone(room) }));
  }
  async read(id: string): Promise<StoredRoom | null> {
    await this.queue;
    const room = this.rooms[id];
    return room && room.expiresAt > Date.now() ? structuredClone(room) : null;
  }
  mutate(id: string, update: (room: StoredRoom) => void, extendTTL = true): Promise<StoredRoom> {
    return this.run(async () => {
      const room = structuredClone(this.rooms[id]);
      if (!room || room.expiresAt <= Date.now()) throw new Error('모임이 만료되었거나 존재하지 않습니다.');
      update(room);
      room.revision = (room.revision ?? 0) + 1;
      if (extendTTL) room.expiresAt = Date.now() + ROOM_TTL;
      await this.save({ ...this.rooms, [id]: room });
      return structuredClone(room);
    });
  }
}
type RedisClient = ReturnType<typeof createClient>;
export class RedisRoomRepository implements RoomRepository {
  constructor(private client: RedisClient, private prefix: string) {}
  private key(id: string) { return this.prefix + ':room:' + id; }
  async create(room: StoredRoom) {
    const result = await this.client.set(this.key(room.id), JSON.stringify(room), { NX: true, PX: ROOM_TTL });
    if (!result) throw new Error('모임을 만들지 못했습니다. 다시 시도해주세요.');
  }
  async read(id: string): Promise<StoredRoom | null> {
    const value = await this.client.get(this.key(id));
    if (!value) return null;
    const room: StoredRoom = JSON.parse(value);
    return room.expiresAt > Date.now() ? room : null;
  }
  async mutate(id: string, update: (room: StoredRoom) => void, extendTTL = true): Promise<StoredRoom> {
    const key = this.key(id);
    // Each WATCH transaction gets its own pooled connection.
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        return await this.client.executeIsolated(async connection => {
          await connection.watch(key);
          try {
            const raw = await connection.get(key);
            if (!raw) throw new Error('모임이 만료되었거나 존재하지 않습니다.');
            const room: StoredRoom = JSON.parse(raw);
            if (room.expiresAt <= Date.now()) throw new Error('모임이 만료되었습니다.');
            update(room);
            room.revision = (room.revision ?? 0) + 1;
            if (extendTTL) room.expiresAt = Date.now() + ROOM_TTL;
            await connection.multi().set(key, JSON.stringify(room), { PX: Math.max(1, room.expiresAt - Date.now()) }).exec();
            return room;
          } finally { await connection.unwatch(); }
        });
      } catch (error) { if (!(error instanceof WatchError)) throw error; }
    }
    throw new Error('모임에 요청이 많습니다. 잠시 후 다시 시도해주세요.');
  }
}
