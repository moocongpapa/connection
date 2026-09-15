import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RoomStore } from './models/Room.js';
import { registerSocketHandlers } from './socket/handlers.js';
import { createRoomRouter } from './routes/room.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:4173'],
  methods: ['GET', 'POST'],
};

app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(httpServer, {
  cors: corsOptions,
});

const roomStore = new RoomStore();

// Mount routes
app.use('/api/room', createRoomRouter(roomStore));

// Socket.io handlers
io.on('connection', (socket) => {
  console.log(`[Connect] New client connected: ${socket.id}`);
  registerSocketHandlers(io, socket, roomStore);
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO is ready for connections`);
});
