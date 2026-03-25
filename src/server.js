import 'dotenv/config';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

import app from './app.js';
import { ENV } from './config/env.js';
import prisma from './config/db.js';
import redis from './config/redis.js';
import { registerChatSocket } from './socket/chat.socket.js';

const httpServer = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: {
    origin: ENV.ALLOWED_ORIGINS.length ? ENV.ALLOWED_ORIGINS : '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// ── Redis Pub/Sub adapter (enables multi-instance scaling + reliable delivery)
try {
  const pubClient = new Redis(ENV.REDIS_URL, { lazyConnect: false });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]).catch(() => {});
  io.adapter(createAdapter(pubClient, subClient));
  console.log('[Socket.IO] Redis adapter attached');
} catch {
  console.warn('[Socket.IO] Redis adapter unavailable — using in-memory adapter');
}

registerChatSocket(io);

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    console.log('[DB] PostgreSQL connected');

    try {
      await redis.connect();
      console.log('[Redis] Connected');
    } catch {
      console.warn('[Redis] Not available — continuing without cache (dev mode)');
    }

    httpServer.listen(ENV.PORT, () => {
      console.log(`[Server] FarmEasy API running on http://localhost:${ENV.PORT}${ENV.API_PREFIX}`);
      console.log(`[Server] Environment: ${ENV.NODE_ENV}`);
    });
  } catch (err) {
    console.error('[Server] Startup failed:', err);
    process.exit(1);
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[Server] ${signal} received — shutting down gracefully`);
  httpServer.close(async () => {
    await prisma.$disconnect();
    await redis.quit().catch(() => {});
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start();
