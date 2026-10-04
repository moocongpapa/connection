import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import { createClient } from 'redis';
import { createApplication } from '../src/app.js';
import { RoomStore, ROOM_TTL, type StoredMember } from '../src/models/Room.js';
import { FileRoomRepository, RedisRoomRepository } from '../src/models/RoomRepository.js';
import { validateLocation } from '../src/socket/handlers.js';

const identity = () => ({ userId: 'usr_' + randomUUID(), token: randomUUID() + randomUUID() });
const profile = { nickname: '테스트', photoBase64: '' };
const position = () => ({ lat: 37.5665, lng: 126.978, accuracy: 8, timestamp: Date.now() });
function event(socket: Socket, name: string, matches: (value: any) => boolean = () => true): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, listener); reject(new Error('Timed out: ' + name)); }, 10000);
    const listener = (value: any) => { if (matches(value)) { clearTimeout(timer); socket.off(name, listener); resolve(value); } };
    socket.on(name, listener);
  });
}
function request(socket: Socket, name: string, data: unknown): Promise<any> {
  return new Promise((resolve, reject) => socket.timeout(10000).emit(name, data, (error: Error | null, value: any) => error ? reject(error) : resolve(value)));
}
async function start(t: TestContext, redisUrl?: string, namespace?: string) {
  const app = createApplication(redisUrl ? { redisUrl, namespace } : { repository: new FileRoomRepository(null), redisUrl: '' });
  await app.ready;
  await new Promise<void>(resolve => app.httpServer.listen(0, '127.0.0.1', resolve));
  const address = app.httpServer.address() as { port: number };
  t.after(() => app.close());
  return { ...app, url: 'http://127.0.0.1:' + address.port };
}
async function connect(t: TestContext, url: string, auth = identity(), origin?: string) {
  const socket = io(url, { auth, autoConnect: false, reconnection: false, transports: ['websocket'], extraHeaders: origin ? { Origin: origin } : {} });
  t.after(() => socket.disconnect());
  const connected = event(socket, 'connect');
  socket.connect(); await connected;
  return { socket, auth };
}
function member(id = 'usr_' + randomUUID(), socketId = randomUUID()): StoredMember {
  return { id, socketId, tokenHash: 'secret', ...profile, location: null, isSharing: false, isOnline: true, joinedAt: Date.now(), lastSeenAt: Date.now() };
}

test('sharing OFF never exposes a coordinate to a new participant or HTTP visitor', async t => {
  const app = await start(t);
  const alice = await connect(t, app.url);
  const created = await request(alice.socket, 'room:create', { ...profile, isSharing: false, location: position() });
  const roomId = created.room.id;
  await request(alice.socket, 'location:update', { roomId, location: position() });
  const bob = await connect(t, app.url);
  const joined = await request(bob.socket, 'room:join', { roomId, ...profile });
  const own = joined.room.members.find((m: any) => m.id === alice.auth.userId);
  assert.equal(own.isSharing, false); assert.equal(own.location, null);
  assert.equal('tokenHash' in own, false); assert.equal('socketId' in own, false);
  const response = await fetch(app.url + '/api/room/' + roomId);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const publicInfo = await response.json();
  assert.deepEqual(Object.keys(publicInfo).sort(), ['expiresAt', 'id', 'memberCount']);
});

test('toggle OFF deletes saved positions and later samples remain hidden', async t => {
  const app = await start(t);
  const alice = await connect(t, app.url);
  const created = await request(alice.socket, 'room:create', { ...profile, isSharing: true });
  const roomId = created.room.id;
  const update = event(alice.socket, 'location:update');
  await request(alice.socket, 'location:update', { roomId, location: position() });
  assert.equal((await update).roomId, roomId);
  const hidden = await request(alice.socket, 'location:toggle', { roomId, isSharing: false });
  assert.equal(hidden.room.members[0].location, null);
  await request(alice.socket, 'location:update', { roomId, location: position() });
  assert.equal((await app.store.getRoom(roomId))!.members[0].location, null);
});

test('a reconnect rejoins with the same identity, restores online status and accepts new samples', async t => {
  const app = await start(t);
  const alice = await connect(t, app.url);
  const created = await request(alice.socket, 'room:create', { ...profile, isSharing: true });
  const roomId = created.room.id;
  const bob = await connect(t, app.url);
  await request(bob.socket, 'room:join', { roomId, ...profile });
  const offline = event(bob.socket, 'room:state');
  const oldId = alice.socket.id;
  alice.socket.disconnect();
  assert.equal((await offline).members.find((m: any) => m.id === alice.auth.userId).isOnline, false);
  const restored = await connect(t, app.url, alice.auth);
  assert.notEqual(restored.socket.id, oldId);
  const joined = await request(restored.socket, 'room:join', { roomId, ...profile, isSharing: true });
  assert.equal(joined.room.members.length, 2);
  assert.equal(joined.room.members.find((m: any) => m.id === alice.auth.userId).isOnline, true);
  const update = event(bob.socket, 'location:update');
  const location = position();
  await request(restored.socket, 'location:update', { roomId, location });
  assert.deepEqual((await update).location, location);
});

test('other tokens cannot take over a participant, and only the creator can set a meeting point', async t => {
  const app = await start(t);
  const alice = await connect(t, app.url);
  const roomId = (await request(alice.socket, 'room:create', profile)).room.id;
  const forged = await connect(t, app.url, { userId: alice.auth.userId, token: identity().token });
  assert.equal((await request(forged.socket, 'room:join', { roomId, ...profile })).ok, false);
  const bob = await connect(t, app.url);
  await request(bob.socket, 'room:join', { roomId, ...profile });
  const point = { lat: 37.5, lng: 127, label: '정문' };
  assert.equal((await request(bob.socket, 'room:meeting-point', { roomId, point })).ok, false);
  assert.deepEqual((await request(alice.socket, 'room:meeting-point', { roomId, point })).room.meetingPoint, point);
  const left = event(bob.socket, 'room:state', value => value.creatorId === bob.auth.userId);
  await request(alice.socket, 'room:leave', { roomId });
  assert.equal((await left).creatorId, bob.auth.userId);
});

test('coordinates require membership and a finite, recent sensor timestamp', async t => {
  const app = await start(t);
  const alice = await connect(t, app.url);
  const roomId = (await request(alice.socket, 'room:create', { ...profile, isSharing: true })).room.id;
  const outsider = await connect(t, app.url);
  assert.equal((await request(outsider.socket, 'location:update', { roomId, location: position() })).ok, false);
  for (const location of [ { ...position(), timestamp: Date.now() - 61_000 }, { ...position(), lat: 91 }, { ...position(), timestamp: Date.now() + 10_000 } ]) {
    assert.equal((await request(alice.socket, 'location:update', { roomId, location })).ok, false);
  }
  assert.equal(validateLocation({ ...position(), lng: NaN }), false);
  assert.equal(validateLocation({ ...position(), accuracy: -1 }), false);
  const repo = new FileRoomRepository(null); const store = new RoomStore(repo); const owner = member(); owner.isSharing = true;
  const room = await store.createRoom(owner);
  const latest = position();
  await store.updateLocation(room.id, owner.id, owner.socketId, latest);
  assert.equal(await store.updateLocation(room.id, owner.id, owner.socketId, { ...latest, timestamp: latest.timestamp - 1 }), null);
  assert.deepEqual((await store.getRoom(room.id))!.members[0].location, latest);
  await store.toggleSharing(room.id, owner.id, owner.socketId, false);
  assert.equal(await store.updateLocation(room.id, owner.id, owner.socketId, { ...latest, timestamp: latest.timestamp + 1 }), null);
  assert.equal((await store.getRoom(room.id))!.members[0].location, null);
});

test('local restart retains rooms and meeting points while clearing presence', async t => {
  const path = await mkdtemp(join(tmpdir(), 'connection-room-test-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  const store = new RoomStore(new FileRoomRepository(join(path, 'rooms.json')));
  const owner = member(); const room = await store.createRoom(owner);
  await store.setMeetingPoint(room.id, owner.id, owner.socketId, { lat: 37, lng: 127, label: '입구' });
  const restarted = new RoomStore(new FileRoomRepository(join(path, 'rooms.json')));
  const restored = (await restarted.getRoom(room.id))!;
  assert.equal(restored.members[0].isOnline, false);
  assert.equal(restored.meetingPoint?.label, '입구');
  assert.ok(restored.expiresAt > Date.now());
});
test('presence heartbeat carries no photo or coordinate and preserves sensor time', async t => {
  const app = await start(t);
  const alice = await connect(t, app.url);
  const roomId = (await request(alice.socket, 'room:create', { ...profile, isSharing: true })).room.id;
  const location = position();
  await request(alice.socket, 'location:update', { roomId, location });
  const presence = event(alice.socket, 'member:presence');
  await request(alice.socket, 'member:heartbeat', { roomId });
  const value = await presence;
  assert.equal('location' in value, false); assert.equal('photoBase64' in value, false);
  assert.equal((await app.store.getRoom(roomId))!.members[0].location!.timestamp, location.timestamp);
});

test('expired rooms are inaccessible and simultaneous joins are not lost', async () => {
  const repo = new FileRoomRepository(null); const store = new RoomStore(repo);
  const owner = member(); const room = await store.createRoom(owner);
  await Promise.all(Array.from({ length: 10 }, () => store.joinRoom(room.id, member())));
  assert.equal((await store.getRoom(room.id))!.members.length, 11);
  await repo.mutate(room.id, room => { room.expiresAt = Date.now() - ROOM_TTL; }, false);
  assert.equal(await store.getRoom(room.id), null);
  await assert.rejects(() => store.joinRoom(room.id, member()));
});
test('the first participant returning to an empty room can manage its meeting point', async () => {
  const store = new RoomStore(new FileRoomRepository(null));
  const owner = member(); const room = await store.createRoom(owner);
  await store.leaveRoom(room.id, owner.id, owner.socketId);
  const returning = member();
  const reopened = await store.joinRoom(room.id, returning);
  assert.equal(reopened.creatorId, returning.id);
  const point = { lat: 37, lng: 127, label: '다시 만날 장소' };
  assert.deepEqual((await store.setMeetingPoint(room.id, returning.id, returning.socketId, point)).meetingPoint, point);
});

test('unlisted cross-origin websocket handshakes are rejected', async t => {
  const app = await start(t);
  const socket = io(app.url, { auth: identity(), autoConnect: false, reconnection: false, transports: ['websocket'], extraHeaders: { Origin: 'https://unlisted.example' } });
  t.after(() => socket.disconnect());
  const refused = event(socket, 'connect_error'); socket.connect();
  assert.ok(await refused); assert.equal(socket.connected, false);
});

test('Redis shares state and broadcasts across servers, surviving an instance restart', { skip: !process.env.TEST_REDIS_URL }, async t => {
  const redisUrl = process.env.TEST_REDIS_URL!;
  const namespace = 'connection:test:' + randomUUID();
  const first = await start(t, redisUrl, namespace); const second = await start(t, redisUrl, namespace);
  const alice = await connect(t, first.url);
  const roomId = (await request(alice.socket, 'room:create', { ...profile, isSharing: true })).room.id;
  const bob = await connect(t, second.url);
  const joined = event(alice.socket, 'room:state');
  await request(bob.socket, 'room:join', { roomId, ...profile });
  assert.equal((await joined).members.length, 2);
  const update = event(bob.socket, 'location:update');
  await request(alice.socket, 'location:update', { roomId, location: position() });
  assert.equal((await update).memberId, alice.auth.userId);
  const off = event(bob.socket, 'room:state');
  await request(alice.socket, 'location:toggle', { roomId, isSharing: false });
  assert.equal((await off).members.find((m: any) => m.id === alice.auth.userId).location, null);
  const redis = createClient({ url: redisUrl }); await redis.connect();
  t.after(() => redis.quit());
  assert.ok(await redis.pTTL(namespace + ':room:' + roomId) > ROOM_TTL - 60_000);
  const repoA = new RedisRoomRepository(redis, namespace);
  const repoB = new RedisRoomRepository(redis, namespace);
  await Promise.all(Array.from({ length: 8 }, (_, i) => new RoomStore(i % 2 ? repoA : repoB).joinRoom(roomId, member())));
  assert.equal((await first.store.getRoom(roomId))!.members.length, 10);
  alice.socket.disconnect(); await first.close();
  const third = await start(t, redisUrl, namespace);
  const restored = await connect(t, third.url, alice.auth);
  const result = await request(restored.socket, 'room:join', { roomId, ...profile, isSharing: false });
  const own = result.room.members.find((m: any) => m.id === alice.auth.userId);
  assert.equal(own.isSharing, false); assert.equal(own.location, null); assert.equal(own.isOnline, true);
});

test('native uploads survive socket loss but cannot bypass OFF, membership or grant rotation', async t => {
  const app = await start(t);
  const alice = await connect(t, app.url);
  const roomId = (await request(alice.socket, 'room:create', { ...profile, isSharing: true })).room.id;
  const first = (await request(alice.socket, 'native:start', { roomId })).room;
  assert.match(first.uploadToken, /^[A-Za-z0-9_-]{43}$/);
  const bob = await connect(t, app.url);
  const joined = await request(bob.socket, 'room:join', { roomId, ...profile });
  assert.equal(JSON.stringify(joined).includes(first.uploadToken), false);
  assert.equal(JSON.stringify(joined).includes('nativeGrant'), false);
  const post = (action: string, body: unknown) => fetch(app.url + '/api/native/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const latestGrant = (await request(alice.socket, 'native:start', { roomId })).room;
  assert.equal((await post('location', { ...first, location: position() })).status, 403);
  assert.equal((await post('location', { ...latestGrant, userId: bob.auth.userId, location: position() })).status, 403);
  assert.equal((await post('location', { ...latestGrant, location: { ...position(), timestamp: Date.now() - 61_000 } })).status, 400);
  const offline = event(bob.socket, 'room:state'); alice.socket.disconnect(); await offline;
  const update = event(bob.socket, 'room:state', room => room.members.some((m: any) => m.id === alice.auth.userId && m.location));
  const response = await post('location', { ...latestGrant, location: position() });
  assert.equal(response.status, 200); assert.equal((await response.json()).accepted, true);
  const own = (await update).members.find((m: any) => m.id === alice.auth.userId);
  assert.equal(own.isOnline, false); assert.equal(own.backgroundSharing, true);
  assert.equal((await (await post('location', { ...latestGrant, location: position() })).json()).accepted, false);
  const resumed = await connect(t, app.url, alice.auth);
  const restored = await request(resumed.socket, 'room:join', { roomId, ...profile, isSharing: true });
  assert.equal(restored.room.members.find((m: any) => m.id === alice.auth.userId).backgroundSharing, true);
  assert.ok(restored.room.members.find((m: any) => m.id === alice.auth.userId).location);
  assert.equal((await post('stop', latestGrant)).status, 200);
  assert.equal((await post('location', { ...latestGrant, location: position() })).status, 403);
  const member = (await app.store.getRoom(roomId))!.members.find(m => m.id === alice.auth.userId)!;
  assert.equal(member.isSharing, false); assert.equal(member.location, null); assert.equal(member.backgroundSharing, false);
  await request(resumed.socket, 'location:toggle', { roomId, isSharing: true });
  const grant = (await request(resumed.socket, 'native:start', { roomId })).room;
  await request(resumed.socket, 'location:toggle', { roomId, isSharing: false });
  assert.equal((await post('location', { ...grant, location: position() })).status, 403);
});

test('native grants expire and a new upload cannot revive a departed participant', async () => {
  const repo = new FileRoomRepository(null); const store = new RoomStore(repo);
  const owner = member(); owner.isSharing = true;
  const room = await store.createRoom(owner);
  const first = await store.startNativeSharing(room.id, owner.id, owner.socketId);
  await repo.mutate(room.id, room => { room.members[owner.id].nativeGrant!.expiresAt = Date.now() - 1; });
  await assert.rejects(() => store.nativeUpdate(room.id, owner.id, first.session.uploadToken, position()));
  const second = await store.startNativeSharing(room.id, owner.id, owner.socketId);
  await store.leaveRoom(room.id, owner.id, owner.socketId);
  await assert.rejects(() => store.nativeUpdate(room.id, owner.id, second.session.uploadToken, position()));
});
