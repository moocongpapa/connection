import { Router } from 'express';
import { RoomStore } from '../models/Room.js';

export function createRoomRouter(roomStore: RoomStore): Router {
  const router = Router();

  router.get('/:roomId/exists', (req, res) => {
    const { roomId } = req.params;
    const exists = roomStore.roomExists(roomId);
    
    if (exists) {
      const members = roomStore.getRoomMembers(roomId);
      res.json({ exists: true, memberCount: members.length });
    } else {
      res.json({ exists: false });
    }
  });

  return router;
}
