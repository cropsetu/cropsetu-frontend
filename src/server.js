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
import { seedDefaultFlags } from './services/featureFlag.service.js';
import logger from './utils/logger.js';

// ── Startup config validation ─────────────────────────────────────────────────
const OPTIONAL_KEYS = [
  ['MSG91_AUTH_KEY',       'OTP delivery via MSG91'],
  ['CLOUDINARY_CLOUD_NAME','Image uploads'],
  ['GEMINI_API_KEY',       'AI crop diagnosis (Gemini)'],
  ['GROQ_API_KEY',         'FarmMind chat + treatment (Groq)'],
  ['SARVAM_API_KEY',       'Voice / multilingual (Sarvam)'],
  ['DATA_GOV_API_KEY',     'Mandi market prices'],
];
for (const [key, feature] of OPTIONAL_KEYS) {
  if (!process.env[key]) {
    logger.warn('[Config] %s not set — %s will be disabled', key, feature);
  }
}

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
// Falls back to in-memory adapter automatically if Redis is unavailable.
// For single-instance demo deployments, Redis is not required.
try {
  const pubClient = new Redis(ENV.REDIS_URL, { lazyConnect: true, retryStrategy: () => null });
  const subClient = pubClient.duplicate();
  pubClient.on('error', () => {});
  subClient.on('error', () => {});
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  logger.info('[Socket.IO] Redis adapter attached');
} catch {
  logger.warn('[Socket.IO] Redis unavailable — using in-memory adapter (single-instance mode)');
}

registerChatSocket(io);

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    logger.info('[DB] PostgreSQL connected');

    // Seed default feature flags (no-op if already seeded)
    await seedDefaultFlags().catch(e => logger.warn('[FeatureFlags] Seed skipped: %s', e.message));

    try {
      await redis.connect();
      logger.info('[Redis] Connected');
    } catch {
      logger.warn('[Redis] Not available — continuing without cache (dev mode)');
    }

    httpServer.listen(ENV.PORT, () => {
      logger.info('[Server] FarmEasy API running on http://localhost:%d%s', ENV.PORT, ENV.API_PREFIX);
      logger.info('[Server] Environment: %s', ENV.NODE_ENV);
    });

    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error('[Server] Port %d already in use. Run: kill -9 $(lsof -ti :%d)', ENV.PORT, ENV.PORT);
        process.exit(1);
      } else {
        throw err;
      }
    });
  } catch (err) {
    logger.error({ err }, '[Server] Startup failed');
    process.exit(1);
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info('[Server] %s received — shutting down gracefully', signal);
  httpServer.close(async () => {
    await prisma.$disconnect();
    await redis.quit().catch(() => {});
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Prevent unhandled async errors from crashing the process.
// Express 4 cannot catch async errors in route handlers that lack try/catch.
// This is the safety net — individual handlers should still use try/catch.
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[Server] Unhandled promise rejection — %s', reason?.message || reason);
  logger.error({ reason }, '[Server] Stack:');
  // Do NOT exit — keep the server running to serve other requests
});

start();
