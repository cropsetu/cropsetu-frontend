import Redis from 'ioredis';
import { ENV } from './env.js';

const redis = new Redis(ENV.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times) => (times > 2 ? null : 500),
});

redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('error', (err) => console.error('[Redis] Error:', err.message));

export default redis;
