import express from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import { RoomStore } from './models/Room.js';
import { FileRoomRepository, RedisRoomRepository, type RoomRepository } from './models/RoomRepository.js';
import { registerSocketHandlers, validateIdentity, validateLocation } from './socket/handlers.js';

export function createApplication(options: { repository?: RoomRepository; origins?: string[]; redisUrl?: string; namespace?: string } = {}) {
  const app = express();
  const httpServer = createServer(app);
  const origins = options.origins ?? (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173').split(',').map(value => value.trim()).filter(Boolean);
  const allowed = (origin?: string, host?: string) => {
    if (!origin) return true;
    try { return origins.includes(origin) || new URL(origin).host === host; } catch { return false; }
  };
  app.use(cors({ origin: (origin, callback) => callback(null, allowed(origin)) }));
  app.use(express.json({ limit: '128kb' }));
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff'); next();
  });
  const io = new Server(httpServer, {
    transports: ['websocket'], maxHttpBufferSize: 128 * 1024, pingInterval: 15_000, pingTimeout: 20_000,
    allowRequest: (req, callback) => callback(null, allowed(req.headers.origin, req.headers.host)),
    cors: { origin: origins },
  });
  const redisUrl = options.redisUrl ?? process.env.REDIS_URL;
  const namespace = options.namespace ?? process.env.REDIS_NAMESPACE ?? 'connection:development';
  const pub = redisUrl ? createClient({ url: redisUrl, socket: { connectTimeout: 10_000 } }) : null;
  const sub = pub?.duplicate();
  let repository: RoomRepository;
  if (options.repository) repository = options.repository;
  else if (pub) repository = new RedisRoomRepository(pub, namespace);
  else if (process.env.VERCEL) throw new Error('Vercel 배포에는 REDIS_URL 환경 변수가 필요합니다.');
  else repository = new FileRoomRepository(resolve(process.env.ROOM_DATA_FILE ?? '.data/rooms.json'));
  const store = new RoomStore(repository);
  pub?.on('error', () => console.error('Redis connection error'));
  sub?.on('error', () => console.error('Redis subscription error'));
  const ready = pub && sub ? Promise.all([pub.connect(), sub.connect()]).then(() => {
    io.adapter(createAdapter(pub, sub, { key: namespace + ':socket' }));
  }) : Promise.resolve();
  ready.catch(() => console.error('Room storage is unavailable'));
  io.use(async (socket, next) => {
    if (!validateIdentity(socket)) return next(new Error('참여자 인증 정보를 확인해주세요.'));
    try { await ready; next(); } catch { next(new Error('서버 저장소 연결을 확인해주세요.')); }
  });
  const drains = new Set<() => Promise<void>>();
  io.on('connection', socket => {
    const drain = registerSocketHandlers(io, socket, store);
    drains.add(drain);
    socket.on('disconnect', () => { void drain().finally(() => drains.delete(drain)); });
  });
  app.get('/api/health', async (_req, res) => {
    try {
      await ready; if (pub) await pub.ping();
      res.json({ ok: true, storage: pub ? 'redis' : 'file' });
    } catch { res.status(503).json({ ok: false }); }
  });
  app.get('/api/room/:roomId', async (req, res) => {
    try {
      await ready;
      const room = await store.getRoom(req.params.roomId);
      if (!room) return res.status(404).json({ message: '모임이 만료되었거나 존재하지 않습니다.' });
      res.json({ id: room.id, memberCount: room.members.length, expiresAt: room.expiresAt });
    } catch { res.status(503).json({ message: '서버 연결을 확인해주세요.' }); }
  });
  app.post('/api/native/:action', async (req, res) => {
    const { roomId, userId, uploadToken, location } = req.body ?? {};
    if (!['location', 'stop'].includes(req.params.action) ||
        typeof roomId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(roomId) ||
        typeof userId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(userId) ||
        typeof uploadToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(uploadToken) ||
        (req.params.action === 'location' && !validateLocation(location))) {
      return res.status(400).json({ ok: false });
    }
    try {
      await ready;
      const result = await store.nativeUpdate(roomId, userId, uploadToken, req.params.action === 'stop' ? null : location);
      if (result.changed) io.to(roomId).emit('room:state', result.room);
      res.json({ ok: true, accepted: result.changed });
    } catch (error) {
      // Never log credentials, coordinates or request bodies.
      const unauthorized = error instanceof Error && /session expired|만료|존재하지/.test(error.message);
      res.status(unauthorized ? 403 : 503).json({ ok: false });
    }
  });
  let closing: Promise<void> | null = null;
  const close = () => closing ??= (async () => {
    await new Promise<void>(done => io.close(() => done()));
    await Promise.allSettled([...drains].map(drain => drain()));
    if (sub?.isOpen) await sub.quit();
    if (pub?.isOpen) await pub.quit();
  })();
  return { app, httpServer, io, store, ready, close };
}
